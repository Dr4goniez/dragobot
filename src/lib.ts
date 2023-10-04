import {
	DynamicObject,
	ApiResponse, ApiResponseError,
	ApiParamsEditPage, ApiParamsQueryEmbeddedIn, ApiParamsQueryBacklinks, ApiParamsQueryCategoryMembers, ApiParamsQuerySearch
} from '.';
import { getMw, init, isBot } from './mw';
import { log } from './server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { rUnicodeBidi } from './title';
import net from 'net';
import isCidr, { v4, v6 } from 'is-cidr';


// ****************************************** ASYNCHRONOUS FUNCTIONS ******************************************

/**
 * Let the code sleep for `n` milliseconds.
 * @param milliseconds The milliseconds to sleep. If a negative number is passed, it is automatically rounded up to `0`.
 * @returns
 */
export function sleep(milliseconds: number): Promise<void> {
	return new Promise<void>(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
}

let lastedit: string;
let tokenExpired: boolean|null;
/**
 * Edit a given page. If the edit fails because of an expired token, another edit attempt is automatically made after re-login.
 *
 * @param params Automatically added params: `{ action: 'edit', token: mw.editToken, formatversion: '2' }`
 * @param autoInterval Ensure a 5 second interval since the last edit, defaulted to `true`.
 * @returns A boolean value indicating whether the edit succeeded, or `null` if a second edit attempt failed.
 */
export async function edit(params: ApiParamsEditPage, autoInterval = true): Promise<boolean|null> {

	// Initialize the request parameters
	let mw = getMw();
	Object.assign(params, {
		action: 'edit',
		token: mw.editToken,
		formatversion: '2'
	});
	if (tokenExpired) {
		tokenExpired = null;
	} else {
		tokenExpired = false;
	}

	// Make sure that it's been more than 5 seconds since the last edit
	if (lastedit && autoInterval) {
		const diff = compareTimestamps(lastedit, new Date().toJSON());
		await sleep(4600 - diff);
	}

	// Edit the page
	log(`Editing ${params.title}...`);
	/** `true` on success, `false` on failure by a known error, `null` on failure by an unknown error. */
	const result: boolean|null = await mw.request(params)
		.then((res: ApiResponse) => {
			return res && res.edit && res.edit.result === 'Success' || null;
		})
		.catch((err: ApiResponseError) => {
			if (err) log(err);
			if (tokenExpired === false && err && err.info.includes('Invalid CSRF token')) {
				tokenExpired = true;
			}
			return false;
		});

	// Process result
	switch (result) {
		case true:
			log(params.title + ': Edit done.');
			lastedit = new Date().toJSON();
			return true;
		case null:
			log(params.title + ': Edit failed due to an unknown error.');
			return false;
		case false:
			log(`${params.title}: Edit failed`);
			if (!tokenExpired) {
				return null;
			} // Continue otherwise
	}

	// Error handler for the expired token
	log('Edit token seems to have expired. Relogging in...');
	mw = await init();
	if (!mw) return null;
	Object.assign(params, {token: mw.editToken});
	return await edit(params, autoInterval);

}

interface BackLlinksOptions {
	/**
	 * The namespace to enumerate. Separate values with a pipe.
	 *
	 * To specify all values, use `*`.
	 */
	blnamespace?: string;
	/**
	 * How to filter for redirects.
	 *
	 * Default: `all`
	 */
	blfilterredir?: 'all'|'nonredirects'|'redirects';
}
/**
 * Get an array of pagetitles are linked to a given page. Transclusions are not included.
 * @param pagetitle
 * @param options
 * @returns Always a string array even if some internal API request failed.
 */
export async function getBackLinks(pagetitle: string, options?: BackLlinksOptions): Promise<string[]> {

	const params: ApiParamsQueryBacklinks = {
		action: 'query',
		list: 'backlinks',
		bltitle: pagetitle,
		bllimit: 'max',
		formatversion: '2'
	};
	Object.assign(params, options || {});

	const response = await continuedRequest(params, Infinity);

	return response.reduce((acc: string[], res) => {
		const resBkl = res && res.query && res.query.backlinks;
		if (resBkl) {
			acc = acc.concat(resBkl.map(({title}) => title));
		}
		return acc;
	}, []);

}

interface CatMembersOptions {
	/**
	 * Only include pages in these namespaces. Note that `cmtype=subcat` or `cmtype=file` may be used instead of
	 * `cmnamespace=14` or `6`. Separate values with a pipe.
	 *
	 * To specify all values, use `*`.
	 */
	cmnamespace?: string;
	/**
	 * Which type of category members to include.
	 *
	 * Values (separate with | or alternative): `file`, `page`, `subcat`
	 *
	 * Default: `page|subcat|file`
	 */
	cmtype?: string;
}
/**
 * Get pagetitles that belong to a given category.
 * @param cattitle A 'Category:' prefix is automatically added if there's none
 * @param options
 * @returns Always a string array even if some internal API request failed.
 */
export async function getCatMembers(cattitle: string, options?: CatMembersOptions): Promise<string[]> {

	if (!/^Category:/i.test(cattitle)) {
		cattitle = 'Category:' + cattitle;
	}

	const params: ApiParamsQueryCategoryMembers = {
		action: 'query',
		list: 'categorymembers',
		cmtitle: cattitle,
		cmprop: 'title',
		cmlimit: 'max',
		formatversion: '2'
	};
	Object.assign(params, options || {});

	const response = await continuedRequest(params, Infinity);

	return response.reduce((acc: string[], res) => {
		const resCm = res && res.query && res.query.categorymembers;
		if (resCm) {
			acc = acc.concat(resCm.map(({title}) => title));
		}
		return acc;
	}, []);

}

interface EmbeddedInOptions {
	/**
	 * The namespace to enumerate. Separate values with a pipe.
	 *
	 * To specify all values, use `*`.
	 */
	einamespace?: string;
	/**
	 * The direction in which to list.
	 *
	 * Default: `ascending`
	 */
	eidir?: 'ascending'|'descending';
	/**
	 * How to filter for redirects.
	 *
	 * Default: `all`
	 */
	eifilterredir?: 'all'|'nonredirects'|'redirects';
	/**
	 * How many total pages to return.
	 *
	 * Default: `max`
	 */
	eilimit?: number|'max';
}
/**
 * Find all pages that embed (i.e. transclude) the given title.
 *
 * Default query parameters:
 * ```
 * {
 * 	action: 'query',
 * 	list: 'embeddedin',
 * 	eititle: pagetitle,
 * 	eilimit: 'max',
 * 	formatversion: '2'
 * }
 * ```
 * @param pagetitle
 * @param options
 * @returns Always a string array even if some internal API request failed.
 */
export async function getEmbeddedIn(pagetitle: string, options?: EmbeddedInOptions): Promise<string[]|null> {

	const params: ApiParamsQueryEmbeddedIn = {
		action: 'query',
		list: 'embeddedin',
		eititle: pagetitle,
		eilimit: 'max',
		formatversion: '2'
	};
	Object.assign(params, options || {});

	const response = await continuedRequest(params, Infinity);

	return response.reduce((acc: string[], res) => {
		const resEmb = res && res.query && res.query.embeddedin;
		if (resEmb) {
			acc = acc.concat(resEmb.map(({title}) => title));
		}
		return acc;
	}, []);

}

/**
 * Perform text search and return matching pagetitles.
 * @param condition
 * @param namespace
 * Search only within these namespaces. Separate values with a pipe.
 *
 * To specify all values, use `*`.
 *
 * Default: `0`
 * @returns Always a string array even if some internal API request failed.
 */
export async function searchText(condition: string, namespace?: string): Promise<string[]> {

	const params: ApiParamsQuerySearch = {
		action: 'query',
		list: 'search',
		srsearch: condition,
		srnamespace: namespace || '0',
		srlimit: 'max',
		srwhat: 'text',
		formatversion: '2'
	};

	const response = await continuedRequest(params, Infinity);

	return response.reduce((acc: string[], res) => {
		const resSr = res && res.query && res.query.search;
		if (resSr) {
			acc = acc.concat(resSr.map(({title}) => title));
		}
		return acc;
	}, []);

}

/**
 * Scrape a webpage.
 * @param url
 * @returns `null` on failure.
 */
export async function scrapeWebpage(url: string): Promise<cheerio.Root|null> {
	try {
		const res = await axios.get(url);
		const $ = cheerio.load(res.data);
		return $;
	}
	catch (err) {
		log(err);
		return null;
	}
}

/**
 * Send an API request that automatically continues until the limit is reached. Works only for calls that have a 'continue' property in the response.
 * @param params
 * @param limit Default: 10
 * @returns The return array might have `null` elements if any internal API request failed.
 */
export function continuedRequest(params: DynamicObject, limit = 10): Promise<(ApiResponse|null)[]> {

	const mw = getMw();
	const responses: (ApiResponse|null)[] = [];

	const query = (params: DynamicObject, count: number): Promise<ApiResponse[]> => {
		return mw.request(params)
			.then((res: ApiResponse) => {
				responses.push(res || null);
				if (res.continue && count < limit) {
					return query(Object.assign(params, res.continue), count + 1);
				} else {
					return responses;
				}
			}).catch((err: ApiResponseError) => {
				log(`continuedRequest: Request failed (reason: ${err.info}, loop count: ${count}).`);
				responses.push(null);
				return responses;
			});
	};

	return query(params, 1);

}

/**
 * Send API requests with an apilimit-susceptible query parameter all at once. For instance:
 * ```
 * {
 * 	action: 'query',
 * 	titles: 'A|B|C|D|...', // This parameter is subject to the apilimit of 500 or 50
 * 	formatversion: '2'
 * }
 * ```
 * Pass the multi-value field as an array, and then this function sends multiple API requests by splicing the array in
 * accordance with the current user's apilimit (`500` for bots, `50` otherwise). It is also neccesary to pass the name
 * of the field to the second parameter of this function (if the request parameters have more than one multi-value field,
 * an array can be passed to the second parameter).
 *
 * @param params The request parameters.
 * @param batchParam The name of the multi-value field (can be an array).
 * @param apilimit
 * Optional splicing number (default: `500/50`). The `**limit` parameter, if there is any, is automatically set to `max`
 * if this argument has the value of either `500` or `50`. It also accepts a unique value like `1`, in cases such as
 * {@link https://www.mediawiki.org/w/api.php?action=help&modules=query%2Bblocks |list=blocks} with a `bkip` parameter
 * (which only allows one IP to be specified).
 * @returns
 * Always an array: Elements are either `ApiResponse` (success) or `null` (failure). If the multi-value field is an empty array,
 * the return array will also be empty.
 */
export function massRequest(params: DynamicObject, batchParams: string|string[], apilimit = isBot() ? 500 : 50): Promise<(ApiResponse|null)[]> {

	// Initialize variables
	params = Object.assign({}, params);
	const nonArrayBatchParams: string[] = [];

	// Get the array to be used for the batch operation
	const batchKeys = Array.isArray(batchParams) ? batchParams : [batchParams];
	const batchArrays = Object.keys(params).reduce((acc: string[][], key) => {
		if (batchKeys.includes(key)) {
			if (Array.isArray(params[key])) {
				acc.push(params[key].slice());
			} else {
				nonArrayBatchParams.push(key);
			}
		} else if (/limit$/.test(key) && (apilimit === 500 || apilimit === 50)) {
			// If this is a '**limit' parameter and the value is the default one, set it to 'max'
			params[key] = 'max';
		}
		return acc;
	}, []); 
	if (nonArrayBatchParams.length) {
		throw new Error('The batch param(s) (' + nonArrayBatchParams.join(', ') + ') must be arrays.');
	} else if (!batchKeys.length) {
		throw new Error('There is a problem with the value of the "batchParams" parameter.');
	} else if (!batchArrays.length) {
		throw new Error('The passed API params do not contain arrays for the batch operation.');
	} else if (batchArrays.length > 1 && !batchArrays.slice(1).every((arr) => arraysEqual(batchArrays[0], arr))) {
		throw new Error('The arrays passed for the batch operation must all be non-distinct with each other.');
	}

	// Final check
	const batchArray = batchArrays[0];
	if (!batchArray.length) {
		console.log('An empty array has been passed for the batch operation.');
		return Promise.resolve([]);
	}

	// Send API requests
	const mw = getMw();
	const req = (reqParams: DynamicObject): Promise<DynamicObject|null> => {
		return mw.request(reqParams)
		.then((res: DynamicObject) => res || null)
		.catch((err: ApiResponseError) => {
			log(err && err.info || 'mw.request reached the catch block.');
			return null;
		});
	};
	const result: Promise<DynamicObject|null>[] = [];
	while (batchArray.length !== 0) {
		const batchArrayStr = batchArray.splice(0, apilimit).join('|');
		Object.assign( // Overwrite the batch parameters with a stringified batch array 
			params,
			batchKeys.reduce((acc: DynamicObject, key) => {
				acc[key] = batchArrayStr;
				return acc;
			}, Object.create(null))
		);
		result.push(req(params));
	}

	return Promise.all(result);

}

// ****************************************** SYNCHRONOUS FUNCTIONS ******************************************

/**
 * Remove unicode bidirectional characters and leading/trailing `\s`s from a string.
 *
 * @param str Input string.
 * @param trim Whether to trim `str`, defaulted to `true`.
 * @returns
 */
export function clean(str: string, trim = true): string {
   str = str.replace(rUnicodeBidi, '');
   return trim ? str.trim() : str;
}

/**
 * Compare two JSON timestamps and get the difference between them in milliseconds.
 * @param earlierTimestamp
 * @param laterTimestamp
 * @param rewindMilliseconds If provided, subtract `earlierTimestamp` by this value (only accepts a positive number).
 * This makes it possible to specify a time earlier than the time represented by `earlierTimestamp`.
 * @returns `laterTimestamp` subtracted by `earlierTimestamp` (in milliseconds). Can be a negative number.
 */
export function compareTimestamps(earlierTimestamp: string|Date, laterTimestamp: string|Date, rewindMilliseconds?: number): number {
	const ts1 = earlierTimestamp instanceof Date ? earlierTimestamp : new Date(earlierTimestamp);
	if (typeof rewindMilliseconds === 'number') {
		ts1.setMilliseconds(ts1.getMilliseconds() - Math.max(0, rewindMilliseconds));
	}
	const ts2 = laterTimestamp instanceof Date ? laterTimestamp : new Date(laterTimestamp);
	return ts2.getTime() - ts1.getTime();
}

/**
 * Get a JSON timestamp of the current time. Milliseconds omitted.
 * @param omitMilliseconds
 * Whether to omit the milliseconds (`2100-01-01T00:00:00Z` instead of `2100-01-01T00:00:00.000Z`).
 *
 * Default: `true`
 * @returns
 */
export function getCurTimestamp(omitMilliseconds = true): string {
	const ts = new Date().toJSON();
	return omitMilliseconds ? ts.split('.')[0] + 'Z' : ts;
}

/**
 * Escapes `\ { } ( ) . ? * + - ^ $ [ ] |` (but not `!`).
 * @param str
 * @returns
 */
export function escapeRegExp(str: string): string {
	return str.replace(/[\\{}().?*+\-^$[\]|]/g, '\\$&');
}

/**
 * Get the last day of a given month.
 * @param year
 * @param month 1-12
 * @returns 28-31
 */
export function lastDay(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/**
 * Get the Japanese name of a day of the week.
 * @param date A JSON timestamp or a Date instance.
 * @returns
 */
export function getWeekDayJa(date: string|Date): string {
	const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
	const d = date instanceof Date ? date : new Date(date);
	return daysOfWeek[d.getDay()];
}

/**
 * Check whether a given string is an IP address.
 * @param ip
 * @param allowBlock Whether to allow a CIDR address.
 * @returns
 */
export function isIPAddress(ip: string, allowBlock = false): boolean {
	return !!net.isIP(ip) || allowBlock && !!isCidr(ip);
}

/**
 * Check whether a given string is an IPv4 address.
 * @param ip
 * @param allowBlock Whether to allow a CIDR address.
 * @returns
 */
export function isIPv4Address(ip: string, allowBlock = false): boolean {
	return net.isIPv4(ip) || allowBlock && v4(ip);
}

/**
 * Check whether a given string is an IPv6 address.
 * @param ip
 * @param allowBlock Whether to allow a CIDR address.
 * @returns
 */
export function isIPv6Address(ip: string, allowBlock = false): boolean {
	return net.isIPv6(ip) || allowBlock && v6(ip);
}

/**
 * A disjunctive union type for primitive types.
 */
type primitive = string|number|bigint|boolean|null|undefined;

/**
 * Check whether two arrays are equal. Neither array should contain non-primitive values as its elements.
 * @param array1
 * @param array2
 * @param orderInsensitive Default: `false`
 * @returns
 */
export function arraysEqual(array1: primitive[], array2: primitive[], orderInsensitive = false): boolean {
	if (orderInsensitive) {
		return array1.length === array2.length && array1.every(el => array2.includes(el));
	} else {
		return array1.length === array2.length && array1.every((el, i) => array2[i] === el);
	}
}

/**
 * Compare elements in two arrays and get differences.
 * @param sourceArray
 * @param targetArray
 * @returns
 */
export function arraysDiff(sourceArray: primitive[], targetArray: primitive[]) {
	const added: primitive[] = [];
	const removed: primitive[] = [];
	sourceArray.forEach((el) => {
		if (!targetArray.includes(el)) removed.push(el);
	});
	targetArray.forEach((el) => {
		if (!sourceArray.includes(el)) added.push(el);
	});
	return {added, removed};
}