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

/** Let the code sleep for n milliseconds. */
export function sleep(milliseconds: number): Promise<void> {
	return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
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
		await sleep(Math.max(0, 4600 - diff));
	}

	// Edit the page
	/**
	 * @param reqParams
	 * @returns `true` on success, `false` on failure by a known error, `null` on failure by an unknown error.
	 */
	const req = (reqParams: ApiParamsEditPage): Promise<boolean|null> => {
		return mw.request(reqParams)
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
	};
	log(`Editing ${params.title}...`);
	const result = await req(params);
	
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
 * @returns
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

/** Scrape a webpage. */
export async function scrapeWebpage(url: string) {
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
 * @returns The returned array might have `null` elements if any internal API request failed.
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
 * Send API requests involving a multi-value field all at once. The multi-value field must be an array, which is
 * internally converted to a pipe-separated string by splicing the array by 500 (or 50 for users without apihighlimits).
 * The name(s) of the multi-value field(s) must also be provided. If the splicing number needs to be configured, pass
 * the relevant number as the third argument.
 * 
 * @param params 
 * @param batchParam
 * The name of the multi-value field (can be an array if there are more than one multi-value field, but the values
 * must be the same.)
 * @param limit
 * Optional splicing number (default: `500/50`). The '**limit' property of the params is automatically set to 'max' if this argument
 * has the value of either 500 or 50, which means that 'max' is selected when no value is passed to this argument, but the parameter
 * is not modified if a unique value is specified for this argument.
 * @returns
 * Always an array: Elements are either `ApiResponse` (success) or `null` (failure). If the batchParam is an empty array,
 * an empty array is returned.
 */
export function massRequest(params: DynamicObject, batchParam: string|string[], limit = isBot() ? 500 : 50): Promise<(ApiResponse|null)[]> {

	// Get the array to be used for the batch operation
	let batchArray: string[];
	if (Array.isArray(batchParam)) { // batchParam: string[]
		const multiValueArrays = Object.keys(params).reduce((acc: string[][], key) => { // Get multi-value arrays as an array
			// e.g. {..., key1: [pages], key2: [pages]}, ['key1', 'key2']
			if (batchParam.includes(key) && Array.isArray(params[key])) {
				acc.push(params[key]);
			}
			return acc;
		}, []); // [ [pages], [pages] ]: All inner arrays must be equal
		const sameArrayProvided = multiValueArrays.slice(1).every((arr) => {
			return arraysEqual(multiValueArrays[0], arr);
		});
		if (!sameArrayProvided) throw new Error('massRequest: Batch fields have different arrays.');
		batchArray = params[batchParam[0]];
	} else { // batchParam: string
		batchArray = params[batchParam];
		if (!Array.isArray(batchArray)) throw new Error('massRequest: Batch field must be an array.');
	}
	if (!batchArray.length) {
		const fieldNames = Array.isArray(batchParam) ? batchParam.join(', ') : batchParam;
		console.log(`massRequest: Batch field is an empty array. (${fieldNames})`);
		return Promise.resolve([]);
	}
	batchArray = batchArray.slice(); // Deep copy

	// Set the '**limit' parameter as 'max' if there's any
	if ([500, 50].includes(limit)) {
		for (const key in params) {
			if (/limit$/.test(key)) {
				params[key] = 'max';
			}
		}
	}

	// Send API requests
	const mw = getMw();
	const req = (reqParams: DynamicObject): Promise<DynamicObject|null> => {
		return mw.request(reqParams)
		.then((res: DynamicObject) => res)
		.catch((err: ApiResponseError) => {
			log(err.info);
			return null;
		});
	};
	const result: Promise<DynamicObject|null>[] = [];
	while (batchArray.length !== 0) {
		const splicedBatchArrayPiped = batchArray.splice(0, limit).join('|');
		if (Array.isArray(batchParam)) {
			Object.keys(params).forEach(key => {
				if (batchParam.includes(key)) {
					params[key] = splicedBatchArrayPiped;
				}
			});
		} else {
			params[batchParam] = splicedBatchArrayPiped;
		}
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
 */
export function clean(str: string, trim = true) {
   str = str.replace(rUnicodeBidi, '');
   return trim ? str.trim() : str;
}

/**
 * @param timestamp1
 * @param timestamp2
 * @param rewind5minutes if true, rewind timestamp1 by 5 minutes
 * @returns timestamp2 - timestamp1 (in milliseconds)
 */
export function compareTimestamps(timestamp1: string, timestamp2: string, rewind5minutes?: boolean) {
	const ts1 = new Date(timestamp1);
	if (rewind5minutes) ts1.setMinutes(ts1.getMinutes() - 5);
	const ts2 = new Date(timestamp2);
	const diff = ts2.getTime() - ts1.getTime();
	return diff;
}

/** Get a JSON timestamp of the current time. Milliseconds omitted. */
export function getCurTimestamp() {
	return new Date().toJSON().split('.')[0] + 'Z';
}

/** 
 * Subtract timestamp2 by timestamp1 and output the resultant duration in Japanese.
 * If the time difference is a negative value, undefined is returned.
 */
export function getDuration(timestamp1: string, timestamp2: string) {

	const ts1 = new Date(timestamp1);
	const ts2 = new Date(timestamp2);
	const diff = ts2.getTime() - ts1.getTime();
	if (diff < 0) return;

	let seconds = Math.round(diff / 1000);
	let minutes = Math.round(seconds / 60);
	let hours = Math.round(minutes / 60);
	let days = Math.round(hours / 24);
	let weeks = Math.round(days / 7);
	let months = Math.round(days / 30);
	let years = Math.floor(days / 365);
	// console.log(seconds, minutes, hours, days, weeks, months, years);

	seconds %= 60;
	minutes %= 60;
	hours %= 24;
	days %= 30;
	weeks %= 7;
	months %= 30;
	years %= 365;
	// console.log(seconds, minutes, hours, days, weeks, months, years);

	let duration: number, unit: string;
	if (years) {
		duration = years;
		unit = '年';
	} else if (months) {
		duration = months;
		unit = 'か月';
	} else if (weeks) {
		duration = weeks;
		unit = '週間';
	} else if (days) {
		duration = days;
		unit = '日';
	} else if (hours) {
		duration = hours;
		unit = '時間';
	} else if (minutes) {
		duration = minutes;
		unit = '分';
	} else {
		duration = seconds;
		unit = '秒';
	}

	switch (unit) {
		case 'か月':
			if (duration % 12 === 0) {
				duration /= 12;
				unit = '年';
			}
			break;
		case '週間':
			if (duration % 4 === 0) {
				duration /= 4;
				unit = 'か月';
			}
			break;
		case '日':
			if (duration % 7 === 0) {
				duration /= 7;
				unit = '週間';
			}
			break;
		case '時間':
			if (duration % 24 === 0) {
				duration /= 24;
				unit = '日';
			}
			break;
		case '分':
			if (duration % 60 === 0) {
				duration /= 60;
				unit = '時間';
			}
			break;
		case '秒':
				if (duration % 60 === 0) {
					duration /= 60;
					unit = '分';
				}
			break;
		default:
	}

	return duration + unit;

}

/** Escapes \ { } ( ) . ? * + - ^ $ [ ] | (but not '!'). */
export function escapeRegExp(str: string) {
	return str.replace(/[\\{}().?*+\-^$[\]|]/g, '\\$&');
}

/**
 * Get the last day of a given month.
 * @param year
 * @param month 1-12
 */
export function lastDay(year: number|string, month: number|string) {
	if (typeof year === 'string') year = parseInt(year);
	if (typeof month === 'string') month = parseInt(month);
	return new Date(year, month, 0).getDate();
}

/** Get the Japanese name of a day of the week from JSON timestamp. */
export function getWeekDayJa(timestamp: string) {
	const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
	return daysOfWeek[new Date(timestamp).getDay()];
}

/** Check whether a given string is an IP address. */
export function isIPAddress(ip: string, allowBlock = false) {
	return net.isIP(ip) || allowBlock && isCidr(ip);
}

/** Check whether a given string is an IPv4 address. */
export function isIPv4Address(ip: string, allowBlock = false) {
	return net.isIPv4(ip) || allowBlock && v4(ip);
}

/** Check whether a given string is an IPv6 address. */
export function isIPv6Address(ip: string, allowBlock = false) {
	return net.isIPv6(ip) || allowBlock && v6(ip);
}

type PrimitiveArray = (string|number|bigint|boolean|null|undefined)[];

/** Check whether two arrays are equal. Neither array should contain objects nor other arrays. */
export function arraysEqual(array1: PrimitiveArray, array2: PrimitiveArray, orderInsensitive = false): boolean {
	if (orderInsensitive) {
		return array1.every(el => array2.includes(el)) && array1.length === array2.length;
	} else {
		return array1.every((el, i) => array2[i] === el) && array1.length === array2.length;
	}
}

/** Compare elements in two arrays. */
export function arrayDiff(sourceArray: PrimitiveArray, targetArray: PrimitiveArray) {
	const added: PrimitiveArray = [];
	const removed: PrimitiveArray = [];
	sourceArray.forEach((el) => {
		if (!targetArray.includes(el)) removed.push(el);
	});
	targetArray.forEach((el) => {
		if (!sourceArray.includes(el)) added.push(el);
	});
	return {added, removed};
}