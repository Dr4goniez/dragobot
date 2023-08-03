import net from 'net';
import isCidr, { v4, v6 } from 'is-cidr';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { log } from './server';
import { getMw, init, isBot } from './mw';
import { DynamicObject, ApiResponse, ApiResponseError, ApiResponseQueryPagesProtection, ApiResponseQueryListSearch, ApiParamsEditPage, ApiParamsQueryEmbeddedIn } from '.';
import * as siteinfo from './siteinfo';
import { ucFirst } from './string';

// ****************************** ASYNCHRONOUS FUNCTIONS ******************************

/**
 * Get the latest revision of a given page.
 * @returns False if the page doesn't exist, undefined if an error occurs, or else an object
 */
export function getLatestRevision(pagename: string) {
	const mw = getMw();
	return new Promise<{
		isRedirect: boolean,
		basetimestamp: string,
		curtimestamp: string,
		content: string,
		revid: string
	}|false|undefined>
	((resolve) => {
		mw.request({
			action: 'query',
			titles: pagename,
			prop: 'info|revisions',
			rvprop: 'ids|timestamp|content',
			rvslots: 'main',
			curtimestamp: 1,
			formatversion: 2
		}).then((res: ApiResponse) => {

			let resPgs;
			if (!res || !res.query || !(resPgs = res.query.pages)) return resolve(undefined);
			if (resPgs.length === 0) return resolve(undefined);
			resPgs = resPgs[0];
			if (resPgs.missing) return resolve(false);

			if (!resPgs.revisions) return resolve(undefined);
			const resRev = resPgs.revisions[0];
			resolve({
				isRedirect: resPgs.redirect ? true : false,
				basetimestamp: resRev.timestamp,
				curtimestamp: res.curtimestamp!,
				content: resRev.slots.main.content,
				revid: resRev.revid.toString()
			});

		}).catch((err: ApiResponseError) => {
			log(err.info)
			resolve(undefined);
		});
	});
}

/** Let the code sleep for n milliseconds. */
export function sleep(milliseconds: number) {
	return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

let lastedit: string;
/**
 * Edit a given page, ensuring a 5 second interval since the last edit. If the edit fails because of an expired token, another edit attempt is automatically made after re-login.
 * @param params Automatically added params: { action: 'edit', token: mw.editToken, formatversion: '2' }
 * @param autoInterval True by default
 * @param retry Automatically set to true for a second edit attempt after re-login. Don't specify this parameter manually.
 * @returns boolean (null if a second edit attempt fails or if the mwbot instance fails to be initialized)
 */
export async function edit(params: ApiParamsEditPage, autoInterval = true, retry?: boolean): Promise<boolean|null> {

	// Initialize the request parameters
	let mw = getMw();
	Object.assign(params, {
		action: 'edit',
		token: mw.editToken,
		formatversion: '2'
	});

	// Make sure that it's been more than 5 seconds since the last edit
	if (lastedit && autoInterval) {
		const diff = compareTimestamps(lastedit, new Date().toJSON());
		if (diff < 4400) await sleep(4400 - diff);
	}

	// Edit the page
	log(`Editing ${params.title}...`);
	/** True if edit succeeds, false if it fails because of an unknown error, undefined if it fails because of a known error. */
	const result: boolean|undefined|null = await mw.request(params)
		.then((res: ApiResponse) => {
			return res && res.edit && res.edit.result === 'Success';
		})
		.catch((err: ApiResponseError) => {
			if (err) log(err);
			return err && err.info && err.info.includes('Invalid CSRF token') ? null : undefined;
		});
	switch (result) {
		case true:
			log(params.title + ': Edit done.');
			lastedit = new Date().toJSON();
			return true;
		case false:
			log(params.title + ': Edit failed due to an unknown error.');
			return false;
		case undefined:
			log(`${params.title}: Edit failed`);
			return false;
		case null:
			log(`${params.title}: Edit failed`);
	}

	// Error handler for an expired token
	if (retry) return null;
	log('Edit token seems to have expired. Relogging in...');
	mw = await init();
	if (!mw) return null;
	Object.assign(params, {token: mw.editToken});
	return await edit(params, autoInterval, true);

}

/**
 * Get an array of pagetitles that have links to a given page, transclusions not included.
 * @param pagetitle
 * @param nsExclude An array of namespace numbers to exclude
 * @returns
 */
export async function getBackLinks(pagetitle: string, nsExclude?: number[]): Promise<string[]|undefined> {

	let pages: string[] = [];
	const mw = getMw();
	if (typeof nsExclude === 'undefined') nsExclude = [];
	const query = (blcontinue?: string) => {
		return new Promise(resolve => {
			mw.request({
				action: 'query',
				list: 'backlinks',
				bltitle: pagetitle,
				bllimit: 'max',
				blcontinue: blcontinue,
				formatversion: '2'
			}).then(async (res: ApiResponse) => {

				let resBL, resCont;
				if (!res || !res.query || !(resBL = res.query.backlinks)) return resolve(log('getBackLinks: Query failed.'));

				const titles = resBL.reduce((acc: string[], obj) => {
					if (!nsExclude!.includes(obj.ns)) {
						acc.push(obj.title);
					}
					return acc;
				}, []);
				pages = pages.concat(titles);

				if (res && res.continue && (resCont = res.continue.blcontinue)) {
					await query(resCont);
				}
				resolve(true);

			}).catch((err: ApiResponseError) => resolve(log(err.info)));
		});
	};

	const result = await query();
	return result ? pages : undefined;

}

/**
 * Get pagetitles that belong to a given category
 * @param cattitle A 'Category:' prefix is automatically added if there's none
 * @param nsExclude An array of namespace numbers to exclude
 * @returns
 */
export async function getCatMembers(cattitle: string, nsExclude?: number[]): Promise<string[]|undefined> {

	if (!/^Category:/i.test(cattitle)) cattitle = 'Category:' + cattitle;

	let cats: string[] = [];
	if (typeof nsExclude === 'undefined') nsExclude = [];
	const mw = getMw();
	const query = (cmcontinue?: string) => {
		return new Promise<true|void>(resolve => {
			mw.request({
				action: 'query',
				list: 'categorymembers',
				cmtitle: cattitle,
				cmprop: 'title',
				cmlimit: 'max',
				cmcontinue: cmcontinue,
				formatversion: '2'
			}).then(async (res: ApiResponse) => {

				let resCM, resCont;
				if (!res || !res.query || !(resCM = res.query.categorymembers)) return resolve(log('getCatMembers: Query failed.'));

				const titles = resCM.reduce((acc: string[], obj) => {
					if (!nsExclude!.includes(obj.ns)) {
						acc.push(obj.title);
					}
					return acc;
				}, []);
				cats = cats.concat(titles);

				if (res && res.continue && (resCont = res.continue.cmcontinue)) {
					await query(resCont);
				}
				resolve(true);

			}).catch((err: ApiResponseError) => resolve(log(err.info)));
		});
	};

	const response = await query();
	const result = response ? cats : undefined;
	if (Array.isArray(result) && result.length === 0) log('No page belongs to ' + cattitle);
	return result;

}

interface EmbeddedInOptions {
	/** The namespace to enumerate. Values (separate with "|"). To specify all values, use "*". */
	einamespace?: string;
	/** The direction in which to list. (Default: ascending) */
	eidir?: 'ascending'|'descending';
	/** How to filter for redirects. (Default: all) */
	eifilterredir?: 'all'|'nonredirects'|'redirects';
	/** How many total pages to return. (Default: 'max') */
	eilimit?: number|'max';
}
/**
 * Find all pages that embed (transclude) the given title.
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
 * @param options Additional query parameters.
 * @returns Null when any (continued) request fails.
 */
export async function getEmbeddedIn(pagetitle: string, options?: EmbeddedInOptions): Promise<string[]|null> {

	let pages: string[] = [];
	let failed = false;
	const mw = getMw();
	const params: ApiParamsQueryEmbeddedIn = {
		action: 'query',
		list: 'embeddedin',
		eititle: pagetitle,
		eilimit: 'max',
		formatversion: '2'
	};
	if (options) {
		Object.assign(params, options);
	}

	const req = (eicontinue?: string): Promise<void> => {
		if (eicontinue) {
			Object.assign(params, {eicontinue});
		}
		return mw.request(params)
			.then((res: ApiResponse) => {
				let resEi, resCont;
				if (!res || !res.query || !(resEi = res.query.embeddedin)) {
					failed = true;
					return;
				}
				pages = pages.concat(resEi.map(obj => obj.title));
				if (res && res.continue && (resCont = res.continue.eicontinue)) {
					return req(resCont);
				}
			})
			.catch((err: ApiResponseError) => {
				log(err.info);
				failed = true;
			});
	};
	await req();
	return failed ? null : pages.filter((el, i, arr) => arr.indexOf(el) === i);

}

/** Filter protected pages out of a list of pagetitles. Returns undefined if any internal query fails. */
export async function filterOutProtectedPages(pagetitles: string[]): Promise<string[]|undefined> {

	const mw = getMw();
	const query = (pagetitlesArr: string[]) => {
		return new Promise<string[]|undefined>(resolve => {
			mw.request({
				action: 'query',
				titles: pagetitlesArr.join('|'),
				prop: 'info',
				inprop: 'protection',
				formatversion: '2'
			}).then((res: ApiResponse) => {

				let resPg;
				if (!res || !res.query || !(resPg = res.query.pages)) return resolve(undefined);

				const d = new Date();
				const isProtected = (prtArr: ApiResponseQueryPagesProtection[]) => {
					return prtArr.some(function(obj) {
						if (!obj.expiry) return false;
						if (obj.expiry.match(/^in/)) return true;
						const protectedUntil = new Date(obj.expiry);
						return d < protectedUntil;
					});
				};

				const titles = resPg.reduce((acc: string[], obj) => {
					let prtArr;
					if (obj.title && (prtArr = obj.protection) && prtArr.length && isProtected(prtArr)) {
						acc.push(obj.title);
					}
					return acc;
				}, []);

				resolve(titles);

			}).catch((err: ApiResponseError) => {
				log(err.info);
				resolve(undefined);
			});
		});
	};

	pagetitles = pagetitles.slice();
	const deferreds = [];
	while (pagetitles.length) {
		deferreds.push(query(pagetitles.splice(0, isBot() ? 500 : 50)));
	}
	const result = await Promise.all(deferreds);

	const failed = result.some(el => !el);
	const protectedPages = result.flat().filter((el): el is string => typeof el === 'string').filter((el, i, arr) => arr.indexOf(el) === i);

	return failed ? undefined : protectedPages;

}

/**
 * Perform text search and return matching pagetitles.
 * @param condition
 * @param namespace ['0'] by default.
 * @returns
 */
export async function searchText(condition: string, namespace?: number[]): Promise<string[]> {

	const mw = getMw();

	if (!namespace) namespace = [0];
	let pagetitles: string[] = [];
	const query = (sroffset?: string) => new Promise<undefined>(resolve => {
		mw.request({
			action: 'query',
			list: 'search',
			srsearch: condition,
			srnamespace: namespace!.map(el => el.toString()).join('|'),
			srlimit: 'max',
			sroffset: sroffset,
			srwhat: 'text',
			formatversion: '2'
		}).then((res: ApiResponse) => {

			let resSr: ApiResponseQueryListSearch[] | undefined;
			if (!res || !res.query || !(resSr = res.query.search) || !resSr.length) return resolve(undefined);
			
			const accumulator : string[] = [];
			const titles = resSr.reduce((acc, obj) => {
				if (obj.title && !acc.includes(obj.title)) acc.push(obj.title);
				return acc;
			}, accumulator);
			pagetitles = pagetitles.concat(titles);

			let resCont: string;
			if (res.continue && (resCont = res.continue.sroffset)) {
				query(resCont).then(() => resolve(undefined));
			} else {
				resolve(undefined);
			}

		}).catch((err: ApiResponseError) => {
			console.log(err.info);
			resolve(undefined);
		});
	});
	
	await query();
	return pagetitles;

}

/** Scrape a webpage. */
export async function scrapeWebpage(url: string) {
	try {
		const res = await axios.get(url);
		const $ = cheerio.load(res.data);
		return $;
	}
	catch (err) {
		return log(err);
	}
}

/** Send an API request that automatically continues until the limit is reached. Works only for calls that have a 'continue' property in the response. */
export function continuedRequest(params: DynamicObject, limit = 10): Promise<ApiResponse[]> {

	const mw = getMw();
	const responses: ApiResponse[] = [];

	const query = (params: DynamicObject, count: number): Promise<ApiResponse[]> => {
		return mw.request(params)
			.then((res: ApiResponse) => {
				responses.push(res);
				if (res.continue && count < limit) {
					return query(Object.assign(params, res.continue), count + 1);
				} else {
					return responses;
				}
			}).catch((err: ApiResponseError) => {
				log(`continuedRequest: Request failed (reason: ${err.info}, loop count: ${count}).`);
				return responses;
			});
	};

	return query(params, 1);

}

/**
 * Send API requests involving a multi-value field all at once. The multi-value field needs to be an array, which is internally converted to a pipe-separated
 * string by splicing the array by 500 (or 50 for users without apihighlimits). The name(s) of the multi-value field(s) must also be provided. If the splicing
 * number needs to be configured, pass the relevant number to the third argument.
 * @param params 
 * @param batchParam The name of the multi-value field (can be an array if there are more than one multi-value field, but the values must be the same.)
 * @param limit Optional splicing number (default: 500/50). The '**limit' property of the params is automatically set to 'max' if this argument has the
 * value of either 500 or 50, which means that 'max' is selected when no value is passed to this argument, but the parameter is not modified if a unique
 * value is specified for this argument.
 * @returns Always an array; Elements are either ApiResponse (success) or null (failure). If the batchParam is an empty array, Promise<[]> (empty array)
 * is returned.
 */
export function massRequest(params: DynamicObject, batchParam: string|string[], limit = isBot() ? 500 : 50): Promise<(ApiResponse|null)[]> {

	// Get the array to be used for the batch operation
	let batchArray;
	if (Array.isArray(batchParam)) {
		const sameArrayProvided = Object.keys(params)
			.filter(key => batchParam.includes(key))
			.map(key => params[key]) // Get multi-value fields as an array
			.every((multiValueFieldArray, i, arr) => {
				return Array.isArray(multiValueFieldArray) && arr.every(allMultiValueFieldArray => arraysEqual(multiValueFieldArray, allMultiValueFieldArray));
			});
		if (!sameArrayProvided) throw new Error('massRequest: Batch fields have different arrays.');
		batchArray = params[batchParam[0]];
	} else {
		batchArray = params[batchParam];
		if (!Array.isArray(batchArray)) throw new Error('massRequest: Batch field in query must be an array.');
	}
	if (batchArray.length === 0) {
		const fieldNames = Array.isArray(batchParam) ? batchParam.join(', ') : batchParam;
		console.log(`massRequest: Batch field is an empty array. (${fieldNames})`);
		return Promise.resolve([]);
	}
	batchArray = batchArray.slice(); // Deep copy

	// Set the '**limit' parameter as 'max' if there's any
	const limitKey = Object.keys(params).filter((key: string) => /limit$/.test(key));
	if (limitKey.length !== 0 && [500, 50].includes(limit)) params[limitKey[0]] = 'max';

	// Send API requests
	const mw = getMw();
	const result = [];
	while (batchArray.length !== 0) {

		const splicedBatchArrayPiped = batchArray.splice(0, limit).join('|');
		if (typeof batchParam === 'string') {
			params[batchParam] = splicedBatchArrayPiped;
		} else {
			Object.keys(params).forEach(key => {
				if (batchParam.includes(key)) params[key] = splicedBatchArrayPiped;
			});
		}

		result.push(
			mw.request(params).then((res: DynamicObject) => res).catch((err: ApiResponseError) => log(err.info))
		);

	}
	
	return Promise.all(result);

}

// ****************************** SYNCHRONOUS FUNCTIONS ******************************

// interfaces for parseTemplates()
export interface Template {
	/** The whole text of the template, starting with '{{' and ending with '}}'. */
	text: string;
	/** Name of the template. The first letter is always in upper case and spaces are represented by underscores. */
	name: string;
	/** Parsed template arguments as an array. */
	arguments: TemplateArgument[];
	/** Nest level of the template. If it's not part of another template, the value is 0. */
	nestlevel: number;
}
export interface TemplateArgument {
	text: string;
	name: string;
	value: string;
}
export interface TemplateConfig {
	/** Also parse templates within subtemplates. True by default. */
	recursive?: boolean;
	/** Whether to include templates within comments (i.e. \<!-- -->). False by default. */
	parseComments?: boolean;
	/** Include template in result only if its name matches this predicate. (Should not be specified together with templatePredicate.)  */
	namePredicate?: (name: string) => boolean;
	/** Include template in result only if it matches this predicate. (Should not be specified together with namePredicate.) */
	templatePredicate?: (template: Template) => boolean;
}

/**
 * Parse templates in wikitext. Templates within \<!-- -->, nowiki, pre, syntaxhighlight, source, and math are ignored.
 * (Those in comment tags can be parsed if TemplateConfig.parseComments is true.)
 * @param wikitext 
 * @param config
 * @param nestlevel Used module-internally. Don't specify this parameter manually.
 * @returns
 * @license siddharthvp@github - This function includes modifications from the original.
 * @link https://github.com/siddharthvp/mwn/blob/ccc6fb8/src/wikitext.ts#L77
 */
export function parseTemplates(wikitext: string, config?: TemplateConfig, nestlevel = 0): Template[] {

	// Initialize config
	const cfg: TemplateConfig = {
		recursive: true,
		parseComments: false,
		namePredicate: undefined,
		templatePredicate: undefined
	};
	Object.assign(cfg, config || {});

	// Number of unclosed braces
	let numUnclosed = 0;

	// Are we in a {{{parameter}}}, or between wikitags that prevent transclusions?
	let inParameter = false;
	let inTag = false;
	const tagNames: string[] = [];

	let parsed: Template[] = [];
	let startIdx, endIdx;

	// Look at every character of the wikitext one by one. This loop only extracts the outermost templates.
	for (let i = 0; i < wikitext.length; i++) {
		const slicedWkt = wikitext.slice(i);
		let matchedTag;
		if (!inParameter && !inTag) {
			if (/^\{\{\{(?!\{)/.test(slicedWkt)) {
				inParameter = true;
				i += 2;
			} else if (/^\{\{/.test(slicedWkt)) {
				if (numUnclosed === 0) {
					startIdx = i;
				}
				numUnclosed += 2;
				i++;
			} else if (/^\}\}/.test(slicedWkt)) {
				if (numUnclosed === 2) {
					endIdx = i + 2;
					const templateText = wikitext.slice(startIdx, endIdx); // Pipes could have been replaced with a control character if they're part of nested templates
					const templateTextPipesBack = replacePipesBack(templateText);
					let templateName = templateTextPipesBack.replace(/\u200e|^\{\{\s*(:?\s*template\s*:|:?\s*テンプレート\s*:)?\s*|\s*[|}][\s\S]*$/gi, '').replace(/ /g, '_');
					templateName = ucFirst(templateName);
					if (!cfg.namePredicate || cfg.namePredicate(templateName)) {
						parsed.push({
							text: templateTextPipesBack,
							name: templateName,
							arguments: parseTemplateArguments(templateText),
							nestlevel: nestlevel
						});
					}
				}
				numUnclosed -= 2;
				i++;
			} else if (wikitext[i] === '|' && numUnclosed > 2) { // numUnclosed > 2 means we're in a nested template
				// Swap out pipes with \x01 character.
				wikitext = strReplaceAt(wikitext, i, '\x01');
			} else if ((matchedTag = slicedWkt.match(/^(?:<!--|<(nowiki|pre|syntaxhighlight|source|math) ?[^>]*?>)/))) {
				const isComment = /^<!--/.test(slicedWkt);
				if (!(cfg.parseComments && isComment)) {
					inTag = true;
					tagNames.push(isComment ? 'comment' : matchedTag[1]);
					i += matchedTag[0].length - 1;
				}
			}
		} else {
			// we are in a {{{parameter}}} or tag 
			if (wikitext[i] === '|' && numUnclosed > 2) {
				wikitext = strReplaceAt(wikitext, i, '\x01');
			} else if ((matchedTag = slicedWkt.match(/^(?:-->|<\/(nowiki|pre|syntaxhighlight|source|math) ?[^>]*?>)/))) {
				const isComment = /^-->/.test(slicedWkt);
				if (!(cfg.parseComments && isComment)) {
					inTag = false;
					tagNames.pop();
					i += matchedTag[0].length - 1;
				}
			} else if (/^\}\}\}/.test(slicedWkt)) {
				inParameter = false;
				i += 2;
			}
		}	 
	}

	// Get nested templates?
	if (cfg.recursive) {
		const accumulator: Template[] = [];
		const subtemplates = parsed.reduce((acc, obj) => {
			const tempInner = obj.text.slice(2, -2);
			if (/\{\{.*\}\}/s.test(tempInner)) {
				acc = acc.concat(parseTemplates(tempInner, cfg, nestlevel + 1))
			}
			return acc;
		}, accumulator);
		parsed = parsed.concat(subtemplates);
	}
	// Filter the array by a user-defined condition?
	if (cfg.templatePredicate) {
		parsed = parsed.filter((Template) => cfg.templatePredicate!(Template));
	}

	return parsed;

}

/** 
 * This function should never be called externally because it presupposes that pipes in nested templates have been replaced with the control character '\x01',
 * and otherwise it doesn't work as expeceted.
 */
function parseTemplateArguments(template: string): TemplateArgument[] {

	if (!template.includes('|')) return [];
	
	let innerContent = template.slice(2, -2); // Remove braces

	// Swap out pipes in links with \x01 control character
	// [[File: ]] can have multiple pipes, so might need multiple passes
	const wikilinkRegex = /(\[\[[^\]]*?)\|(.*?\]\])/g;
	while (wikilinkRegex.test(innerContent)) {
		innerContent = innerContent.replace(wikilinkRegex, '$1\x01$2');
	}

	const args = innerContent.split('|').map(el => el.trim());
	args.shift(); // Remove template name
	let unnamedArgCount = 0;

	const parsedArgs: TemplateArgument[] = args.map((arg) => {

		// Replace {{=}}s with a (unique) control character
		// The magic words could have spaces before/after the equal sign in an inconsistent way
		// We need the input string back as it was before replacement, so mandane replaceAll isn't a solution here 
		const magicWordEquals = arg.match(/\{\{\s*=\s*\}\}/g) || [];
		magicWordEquals.forEach((equal, i) => arg = arg.replace(equal, `$EQ${i}`));

		let argName: string, argValue: string;
		const indexOfEqual = arg.indexOf('=');
		if (indexOfEqual >= 0) { // The argument is named
			argName = arg.slice(0, indexOfEqual).trim();
			argValue = arg.slice(indexOfEqual + 1).trim();
			if (argName === unnamedArgCount.toString()) unnamedArgCount++;
		} else { // The argument is unnamed
			argName = (++unnamedArgCount).toString();
			argValue = arg.trim();
		}

		// Get the replaced {{=}}s back
		magicWordEquals.forEach((equal, i) => {
			const replacee = `$EQ${i}`;
			arg = arg.replace(replacee, equal);
			argName = argName.replace(replacee, equal);
			argValue = argValue.replace(replacee, equal);
		});

		return {
			text: replacePipesBack(arg),
			name: replacePipesBack(argName),
			value: replacePipesBack(argValue)
		}

	});

	return parsedArgs;

}

function strReplaceAt(string: string, index: number, char: string): string {
	return string.slice(0, index) + char + string.slice(index + 1);
}

function replacePipesBack(string: string) {
	// eslint-disable-next-line no-control-regex
	return string.replace(/\x01/g, '|');
}

// interfaces for parseHtml()
export interface Html {
	/** OuterHTML of the tag. */
	text: string;
	/** Name of the tag in lower case. */
	name: string;
	/** Nest level of the tag. If it's not part of another tag, the value is 0. */
	nestlevel: number;
	/** Whether the tag is closed by itself. */
	selfclosing: boolean;
	/**
	 * Indexes of the html tag in the input string. The end index is 'characters up to or not including', so the relevant tag can be extracted
	 * from the input string by "input.slice(index.start, index.end)".
	 */
	index: {
		start: number;
		end: number;
	};
}
export interface HtmlConfig {
	/**
	 * Include tag in result only if its name matches this predicate, where \<!-- --> tags are named as 'comment'.
	 * (Should not be specified together with htmlPredicate.)
	 */
	namePredicate?: (name: string) => boolean;
	/** Include tag in result only if it matches this predicate. (Should not be specified together with namePredicate.) */
	htmlPredicate?: (Html: Html) => boolean;
}

/**
 * Parse a plain text and extract html tags in it, including \<!-- --> tags. This function is fast because it doesn't involve parsing into DOM.
 * @param html 
 * @param config 
 * @returns 
 */
export function parseHtml(html: string, config?: HtmlConfig): Html[] {

	// Initialize config
	config = Object.assign({
		namePredicate: null,
		htmlPredicate: null
	}, config || {});

	// eslint-disable-next-line no-useless-escape
	const openingTagRegex = /^(?:<!--|<([a-z]+) ?[^\/>]*?>)/i;
	const closingTagRegex = /^(?:-->|<\/([a-z]+) ?[^>]*?>)/i;
	const selfclosingTagRegex = /^<([a-z]+) ?[^>]*?\/>/i;

	let matched;
	let parsed = [];
	interface Tags {
		name: string;
		startIdx: number;
		selfclosingIdx: number;
	}
	const tags: Tags[] = []; // All elements are pushed into the beginning of the array in the loop below (unshift)

	for (let i = 0; i < html.length; i++) {
		const slicedHtml = html.slice(i);

		// For when the current index is the start of <tag /> (self-closing)
		if ((matched = slicedHtml.match(selfclosingTagRegex))) {

			parsed.push({
				text: html.slice(i, i + matched[0].length),
				name: matched[1].toLowerCase(),
				nestlevel: NaN,
				selfclosing: true,
				index: {
					start: i,
					end: i + matched[0].length
				}
			});
			i += matched[0].length - 1;

		// Not the start of a self-closing tag
		} else {

			// Not inside any other tags
			if (tags.length === 0) {

				// Start of a new tag
				if ((matched = slicedHtml.match(openingTagRegex))) {

					// Save the current index and the tag name
					tags.unshift({
						name: matched[1] ? matched[1].toLowerCase() : 'comment',
						startIdx: i,
						selfclosingIdx: i + matched[0].length
					});
					i += matched[0].length - 1; // Continue the loop after the end of the matched tag

				// End of a tag (ungrammatical)
				} else if ((matched = slicedHtml.match(closingTagRegex))) {
					i += matched[0].length - 1; // Just skip
				}

			// Inside some other tags
			} else {

				// Start of a new tag (nested tag); same as when not nested
				if ((matched = slicedHtml.match(openingTagRegex))) {

					tags.unshift({
						name: matched[1] ? matched[1].toLowerCase() : 'comment',
						startIdx: i,
						selfclosingIdx: i + matched[0].length
					});
					i += matched[0].length - 1;

				// End of a tag
				} else if ((matched = slicedHtml.match(closingTagRegex))) {

					const endIdx = i + matched[0].length;
					const tagName = matched[1] ? matched[1].toLowerCase() : 'comment';
					let deleteIdx;

					// Asssume that the html has the structure of '<p> ... <br> ... </p>' in the comments below
					tags.some((obj, j) => {
						if (obj.name === tagName) { // There's a <p> for the </p>; just need to find the start index of the <p>
							parsed.push({
								text: html.slice(obj.startIdx, endIdx),
								name: obj.name,
								nestlevel: NaN,
								selfclosing: false,
								index: {
									start: obj.startIdx,
									end: endIdx
								}
							});
							deleteIdx = j + 1;
							return true;
						} else { // There's a <br> for the </p>; <br> closes itself, neccesary to retrieve the start and end indexes from the saved tag object
							parsed.push({
								text: html.slice(obj.startIdx, obj.selfclosingIdx),
								name: obj.name,
								nestlevel: NaN,
								selfclosing: true,
								index: {
									start: obj.startIdx,
									end: obj.selfclosingIdx
								}
							});
							return false;
						}
					});
					tags.splice(0, deleteIdx); // Remove pushed tags, e.g. [br, p, span, p, ...] => [span, p, ...]

				}

			}
		}
	}

	// Deal with elements that are still in the tags array (self-closing ones)
	// E.g. '<br> ... <br> (... <p></p>)'; <br>s are still in the array because they don't have corresponding closing tags
	tags.forEach(obj => {
		parsed.push({
			text: html.slice(obj.startIdx, obj.selfclosingIdx),
			name: obj.name,
			nestlevel: NaN,
			selfclosing: true,
			index: {
				start: obj.startIdx,
				end: obj.selfclosingIdx
			}
		});
	});

	// Sort the result by start index and set nestlevel
	parsed = parsed.sort((obj1, obj2) => obj1.index.start - obj2.index.start);
	parsed.forEach((obj, i, arr) => {
		// If the relevant indexes are e.g. '0 ... [1 ... 59] ... 60', the nestlevel is 1
		const nestlevel = arr.filter(objF => objF.index.start < obj.index.start && obj.index.end < objF.index.end).length;
		obj.nestlevel = nestlevel;
	});

	// Filter the result by config
	if (config) {
		// Filter the array by tag name(s)?
		if (config.namePredicate) {
			parsed = parsed.filter(({name}) => config!.namePredicate!(name));
		}
		// Filter the array by a user-defined condition?
		if (config.htmlPredicate) {
			parsed = parsed.filter((Html) => config!.htmlPredicate!(Html));
		}
	}

	return parsed;

}

/**
 * Get strings enclosed by \<!-- -->, \<nowiki />, \<pre />, \<syntaxhighlight />, \<source />, and \<math />,not including those nested
 * inside other occurrences of these tags.
 */
export function getCommentTags(wikitext: string): string[] {
	const namePredicate = (name: string) => {
		return ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source', 'math'].includes(name);
	};
	const commentTags = parseHtml(wikitext, {namePredicate: namePredicate})
		.filter((Html, i, arr) => {
			// Get rid of comment tags that are nested inside bigger comment tags
			return !arr.some((Html2) => Html2.index.start < Html.index.start && Html.index.end < Html2.index.end);
		})
		.map((Html) => Html.text);
	return commentTags;
}

/**
 * Replace strings by given strings in a wikitext, ignoring replacees in tags that prevent transclusions (i.e. \<!-- -->, nowiki, pre, syntaxhighlight, source, math).
 * The replacees array and the replacers array must have the same number of elements in them. This restriction does not apply only if the replacees are to be 
 * replaced with one unique replacer, and the 'replacers' argument is a string or an array containing only one element. 
 */
export function replaceWikitext(wikitext: string, replacees: (string|RegExp)[], replacers: string|string[]): string {

	let replacersArr: string[] = [];
	if (typeof replacers === 'string') {
		replacersArr.push(replacers);
	} else {
		replacersArr = replacers.slice(); // Deep copy
	}
	if (replacees.length !== replacersArr.length && replacersArr.length === 1) {
		replacees.forEach((el, i) => {
			if (i === 0) return;
			replacersArr.push(replacersArr[0]);
		});
	}
	if (replacees.length !== replacersArr.length) throw 'replaceWikitext: replacees and replacers must have the same number of elements in them.';

	// Extract transclusion-preventing tags in the wikitext
	const commentTags = getCommentTags(wikitext);

	// Temporarily replace comment tags with a (unique) control character
	commentTags.forEach((tag, i) => {
		wikitext = wikitext.replace(tag, `$CO${i}`);
	});

	// Replace all
	for (let i = 0; i < replacees.length; i++) {
		wikitext = wikitext.split(replacees[i]).join(replacersArr[i]);
	}

	// Get the comment tags back
	commentTags.forEach((tag, i) => {
		wikitext = wikitext.replace(`$CO${i}`, tag);
	});

	return wikitext;

}

interface ParsedSection {
	header: string|null;
	title: string|null;
	level: number;
	index: number;
	content: string;
	deepest: boolean|null;
}

/** Parse the content of a page into that of each section. */
export function parseSections(content: string): Array<ParsedSection> {

	const regex = {
		comments: /<!--[\s\S]*?-->|<(nowiki|pre|syntaxhighlight|source|math)[\s\S]*?<\/\1\s*>/gi,
		header: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}/,
		headerG: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}/g,
		headerEquals: /(?:^={2,5}[^\S\n\r]*|[^\S\n\r]*={2,5}$)/g
	};

	// Replace comment-related tags
	let idx = 0;
	const comments: string[] = [];
	let m;
	while ((m = regex.comments.exec(content))) {
		content = content.replace(m[0], '$CM' + (idx++));
		comments.push(m[0]);
	}

	// Get headers
	const headers: {text: string; title: string; level: number; index: number;}[] = [];
	while ((m = regex.headerG.exec(content))) {
		headers.push({
			text: m[0],
			title: m[0].replace(regex.headerEquals, ''),
			level: (m[0].match(/=/g) || []).length / 2,
			index: m.index // This is the index number of the header in the content
		});
	}
	headers.unshift({text: '', title: '', level: 1, index: 0}); // For the top section

	// Return an array of objects
	return headers.map(({text, title, level, index}, i, arr) => {
		const isTopSection = i === 0;
		let sectionContent = arr.length > 1 ? content.slice(0, arr[1].index) : content; // For the top section
		let deepest: null|boolean = null;
		if (!isTopSection) { // For non-top sections
			const nextSameLevelSection = arr.slice(i + 1).filter(obj => obj.level <= level);
			sectionContent = content.slice(index, nextSameLevelSection.length ? nextSameLevelSection[0].index : content.length);
			const dRegex = new RegExp(`(={${level + 1},})[^\\S\\n\\r]*.+[^\\S\\n\\r]*\\1`);
			deepest = !dRegex.test(sectionContent.slice(text.length));
		}
		comments.forEach((el, j) => sectionContent = sectionContent.replace(`$CM${j}`, el)); // Get comments back
		return {
			header: isTopSection ? null : text,
			title: isTopSection ? null : title,
			level: level,
			index: i,
			content: sectionContent,
			deepest: deepest
		};
	});

}

interface ExternalLink {
	/** Full wikitext of the external link. */
	text: string;
	/** Target of the link, usually an URL. */
	target: string;
	/** Displayed text of the link. Null if not specified. */
	display: string | null;
	/** Whether the link is external. */
	external: true;
}
interface InternalLink {
	/** Full wikitext of the internal link. */
	text: string;
	/** Whether the link is an external one. */
	external: false;
	/** Whether the link is an interwiki one. */
	interwiki: boolean;  
	/** Whether the link is shown as a file. If false, coloned is of type boolean and display is of type string. If true, coloned is of type false and display is of type string[].*/
	file: boolean;
	/** Whether the link starts with a colon. */
	coloned: boolean;
	/** 
	 * If file === false:
	 * Displayed text of the link. Same as target if not specified. Could include lowercase alphabets that immediately follow the closure of the link.
	 * If file === true:
	 * Parameters of the file link. (Trailing alphabets are irrelevant.)
	 */
	display: string | string[];
}
interface InternalLinkComplete extends InternalLink {
	target: {
		/** Target of the link without a namespace prefix. */
		title: string;
		/** Target of the link with a namespace prefix. */
		prefixedtitle: string;
		/** Section name starting with '#', if the title contains any. */
		section: string | null;
		/** project prefixes + prefixedtitle + section. */
		fullpath: string;
		/** Array of interwiki prefixes. */
		prefix: string[];
		/** Name of the target's namespace. Expect an inaccurate result for interwiki links. */
		namespace: string;
		/** ID of the target's namespace. Expect an inaccurate result for interwiki links. */
		namespaceid: string;
	};
	/** Whether the link target is a page's fragment (i.e. page-internal section or subpage). */
	incomplete: false;
}
interface InternalLinkIncomplete extends InternalLink {
	target: {
		/** Target of the link without a namespace prefix. Always null if 'pagetitle' isn't provided and if the link is a fragment. */
		title: null;
		/** Target of the link with a namespace prefix. Always null if 'pagetitle' isn't provided and if the link is a fragment. */
		prefixedtitle: null;
		/** Section name starting with '#', if the title contains any. */
		section: string | null;
		/** project prefixes + prefixedtitle + section. Always null if 'pagetitle' isn't provided and if the link is a fragment. */
		fullpath: null;
		/** Array of interwiki prefixes. */
		prefix: string[];
		/** Name of the target's namespace. Always null if 'pagetitle' isn't provided and if the link is a fragment. */
		namespace: null;
		/** ID of the target's namespace. Always null if 'pagetitle' isn't provided and if the link is a fragment. */
		namespaceid: null;
	};
	/** Whether the link target is a page's fragment (i.e. page-internal section or subpage). */
	incomplete: true;
}
type Link = ExternalLink | InternalLinkComplete | InternalLinkIncomplete;

interface RawLinks {
	/** Full wikitext of the link. */
	text: string;
	/** Whether the link is external. */
	external: boolean;
	/** 
	 * Lowercase alphabets that immediately follow the closure of the link (relevant only to internal ones). This information is neccesary
	 * in order to figure out what the displayed text will be, because it will be "scripts" if e.g. "[[script]]s", not just "script". This
	 * property gets an empty string if no letter meets the condition to be inclusive.
	 */
	inclusive: string;
}

/**
 * Parse links in a given wikitext.
 * @param wikitext Wikitext to parse.
 * @param pagetitle Namespace-prefixed title to parse. Supplemented if the link starts with '#' (page-internal section link) or '/' (subpage link).
 * Expect an incomplete result when not providing any.
 * @param linkPredicate Predicate to filter out the result.
 * @returns
 */
export function parseLinks(wikitext: string, pagetitle?: string, linkPredicate?: (Link: Link) => boolean): Link[] {

	const rawLinks: RawLinks[] = [];

	let inLink = false;
	let startIdx, endIdx;
	let numUnclosed = 0;

	// Extract links from the input text and create an array of objects
	for (let i = 0; i < wikitext.length; i++) {
		const slicedWkt = wikitext.slice(i);
		if (!inLink) {
			if (/^\[\[/.test(slicedWkt)) {
				startIdx = i;
				inLink = true;
				i++;
			} else if (wikitext[i] === '[') {
				startIdx = i;
				inLink = true;
			}
		} else {
			if (wikitext[i] === ']' && numUnclosed !== 0) {
				numUnclosed--;
			} else if (wikitext[i] === '[') { // Nested ungrammatical link
				numUnclosed++;
			} else if (/^\]\]/.test(slicedWkt)) {
				endIdx = i + 2;
				inLink = false;
				numUnclosed = 0;
				const inclusive = (slicedWkt.slice(2).match(/^[a-z]+/) || [''])[0];
				rawLinks.push({
					text: wikitext.slice(startIdx, endIdx),
					external: false,
					inclusive
				});
				i++;
			} else if (wikitext[i] === ']') {
				endIdx = i + 1;
				inLink = false;
				numUnclosed = 0;
				rawLinks.push({
					text: wikitext.slice(startIdx, endIdx),
					external: true,
					inclusive: ''
				});
			}
		}
	}
	if (rawLinks.length === 0) return [];

	// Parse the links
	let links = rawLinks.map(({text, external, inclusive}) => {

		// Remove the leading and trailing bracket(s)
		let linkTrunc: string = external ? text.slice(1, -1) : text.slice(2, -2);

		// Get templates inside the link and replace pipes/spaces in them with a control character
		const templates = parseTemplates(linkTrunc, {templatePredicate: (Template) => Template.nestlevel === 0}).map(Template => Template.text);
		const replacee = external ? / /g : /\|/g;
		templates.forEach((template) => {
			linkTrunc = linkTrunc.split(template).join(template.replace(replacee, '\x01'));
		});

		if (external) {

			const params = split2(linkTrunc, ' ').map(el => el.trim().replace(/\\x01/g, ' '));
			return {
				text,
				target: params[0],
				display: params[1] ? params[1] : null,
				external
			};

		} else {

			const params = linkTrunc.split('|').map(el => el.trim().replace(/\\x01/g, '|'));
			let isFragment = ['#', '/'].includes(params[0][0]);
			if (pagetitle && isFragment) {
				params[0] = pagetitle + params[0];
				isFragment = false;
			}
			const isColoned = params[0][0] === ':';
			const isFile = /\bfile:/i.test(params[0]);
			const displayedText: string | string[] = isFile ? params.slice(1) : (params.length === 1 ? params[0].replace(/^:/, '') : params.slice(1).join('|')) + inclusive;
			const colonArr = params[0].split(':').filter(el => el); // Split the link target by colon and remove empty strings
			const prefixes = colonArr.filter(el => siteinfo.projectPrefixes.includes(el.toLowerCase())).map(el => el.toLowerCase());
			const isInterwiki = prefixes.length !== 0;

			// Get the link target's namespace
			const nsIdx = colonArr.findIndex(el => siteinfo.namespaces.includes(el.toLowerCase().replace(/ /g, '_')));
			let nsId: string | null = '0';
			let ns: string | null = '';
			if (nsIdx !== -1) {
				const key = colonArr[nsIdx].toLowerCase().replace(/ /g, '_');
				nsId = siteinfo.namespaceIds[key as keyof typeof siteinfo.namespaceIds].toString();
				ns = siteinfo.normalizedNamespaces[nsId as keyof typeof siteinfo.normalizedNamespaces];
			}

			// Get title and section
			let m;
			const section = ((m = params[0].match(/#.+/))) ? m[0] : m;
			const prefixRegex = new RegExp(`^:?${prefixes.length !== 0 ? prefixes.join(':') + ':' : ''}`);
			let title = colonArr.slice(nsIdx + 1).join(':').replace(prefixRegex, '');
			if (section) title = title.replace(section, '');
			const prefixedtitle = nsId === '0' ? title : `${ns}:${title}`;

			// Return object
			if (isFragment) {
				return {
					text,
					external,
					interwiki: isInterwiki,
					file: isFile,
					coloned: isColoned,
					display: displayedText,
					target: {
						title: null,
						prefixedtitle: null,
						section,
						fullpath: null,
						prefix: prefixes,
						namespace: null,
						namespaceid: null
					},
					incomplete: isFragment
				};
			} else {
				return {
					text,
					external,
					interwiki: isInterwiki,
					file: isFile,
					coloned: isColoned,
					display: displayedText,
					target: {
						title,
						prefixedtitle,
						section,
						fullpath: prefixes.join(':') + (prefixes.length !== 0 ? ':' : '') + prefixedtitle + (section ? section : ''),
						prefix: prefixes,
						namespace: ns,
						namespaceid: nsId
					},
					incomplete: isFragment
				};
			}

		}

	});

	if (linkPredicate) {
		links = links.filter(Link => linkPredicate(Link));
	}

	return links;

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
export function isIPAddress(ip: string) {
	return net.isIP(ip) || isCidr(ip);
}

/** Check whether a given string is an IPv4 address. */
export function isIPv4Address(ip: string) {
	return net.isIPv4(ip) || v4(ip);
}

/** Check whether a given string is an IPv6 address. */
export function isIPv6Address(ip: string) {
	return net.isIPv6(ip) || v6(ip);
}

/** Split a string into two at the first (or last if bottomup === true) occurrence of a delimiter. If the passed string doesn't contain the delimiter, either the first (bottomup) or the second (!bottomup) element will be an empty string. The delimiter between the two segments won't be included in them. */
export function split2(str: string, delimiter: string, bottomup?: boolean): string[] {
	const chunks = str.split(delimiter);
	if (bottomup) {
		return [chunks.pop()!, chunks.join(delimiter)].reverse();
	} else {
		return [chunks.shift()!, chunks.join(delimiter)];
	}
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