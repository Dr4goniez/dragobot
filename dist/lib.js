"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arraysEqual = exports.split2 = exports.isIPv6Address = exports.isIPv4Address = exports.isIPAddress = exports.getWeekDayJa = exports.lastDay = exports.escapeRegExp = exports.getDuration = exports.getCurTimestamp = exports.compareTimestamps = exports.parseLinks = exports.parseSections = exports.replaceWikitext = exports.getCommentTags = exports.parseHtml = exports.parseTemplates = exports.massRequest = exports.continuedRequest = exports.scrapeWebpage = exports.filterOutProtectedPages = exports.getTranscludingPages = exports.getCatMembers = exports.getBackLinks = exports.edit = exports.sleep = exports.getLatestRevision = void 0;
const net_1 = __importDefault(require("net"));
const is_cidr_1 = __importStar(require("is-cidr"));
const cheerio = __importStar(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
const server_1 = require("./server");
const mw_1 = require("./mw");
const siteinfo = __importStar(require("./siteinfo"));
// ****************************** ASYNCHRONOUS FUNCTIONS ******************************
/**
 * Get the latest revision of a given page.
 * @returns False if the page doesn't exist, undefined if an error occurs, or else an object
 */
function getLatestRevision(pagename) {
    const mw = (0, mw_1.getMw)();
    return new Promise((resolve) => {
        mw.request({
            action: 'query',
            titles: pagename,
            prop: 'info|revisions',
            rvprop: 'ids|timestamp|content',
            rvslots: 'main',
            curtimestamp: 1,
            formatversion: 2
        }).then((res) => {
            let resPgs;
            if (!res || !res.query || !(resPgs = res.query.pages))
                return resolve(undefined);
            if (resPgs.length === 0)
                return resolve(undefined);
            resPgs = resPgs[0];
            if (resPgs.missing)
                return resolve(false);
            if (!resPgs.revisions)
                return resolve(undefined);
            const resRev = resPgs.revisions[0];
            resolve({
                isRedirect: resPgs.redirect ? true : false,
                basetimestamp: resRev.timestamp,
                curtimestamp: res.curtimestamp,
                content: resRev.slots.main.content,
                revid: resRev.revid.toString()
            });
        }).catch((err) => {
            (0, server_1.log)(err.info);
            resolve(undefined);
        });
    });
}
exports.getLatestRevision = getLatestRevision;
/** Let the code sleep for n milliseconds. */
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
exports.sleep = sleep;
let lastedit;
/**
 * Edit a given page, ensuring a 5 second interval since the last edit. If the edit fails because of an expired token, another edit attempt is automatically made after re-login.
 * @param params Automatically added params: { action: 'edit', token: mw.editToken, formatversion: '2' }
 * @param autoInterval True by default
 * @param retry Automatically set to true for a second edit attempt after re-login. Don't specify this parameter manually.
 * @returns apiReponse (null if a second edit attempt fails or if the mwbot instance fails to be initialized)
 */
async function edit(params, autoInterval = true, retry) {
    // Initialize the request parameters
    let mw = (0, mw_1.getMw)();
    Object.assign(params, {
        action: 'edit',
        token: mw.editToken,
        formatversion: '2'
    });
    // Make sure that it's been more than 5 seconds since the last edit
    if (lastedit && autoInterval) {
        const diff = compareTimestamps(lastedit, new Date().toJSON());
        if (diff < 4400)
            await sleep(4400 - diff);
    }
    // Edit the page
    (0, server_1.log)(`Editing ${params.title}...`);
    let apiReponse;
    let apiReponseErr;
    /** True if edit succeeds, false if it fails because of an unknown error, undefined if it fails because of a known error. */
    const result = await mw.request(params)
        .then((res) => {
        apiReponse = res;
        return res && res.edit && res.edit.result === 'Success';
    })
        .catch((err) => {
        apiReponseErr = err;
        return;
    });
    switch (result) {
        case true:
            (0, server_1.log)(params.title + ': Edit done.');
            lastedit = new Date().toJSON();
            return apiReponse;
        case false:
            (0, server_1.log)(params.title + ': Edit failed due to an unknown error.');
            return apiReponse;
        default:
            (0, server_1.log)(params.title + ': Edit failed: ' + apiReponseErr.info);
            if (!apiReponseErr.info.includes('Invalid CSRF token'))
                return apiReponseErr;
    }
    // Error handler for an expired token
    if (retry)
        return null;
    (0, server_1.log)('Edit token seems to have expired. Relogging in...');
    mw = await (0, mw_1.init)();
    if (!mw)
        return null;
    Object.assign(params, { token: mw.editToken });
    return await edit(params, autoInterval, true);
}
exports.edit = edit;
/**
 * Get an array of pagetitles that have links to a given page, transclusions not included.
 * @param pagetitle
 * @param nsExclude An array of namespace numbers to exclude
 * @returns
 */
async function getBackLinks(pagetitle, nsExclude) {
    let pages = [];
    const mw = (0, mw_1.getMw)();
    if (typeof nsExclude === 'undefined')
        nsExclude = [];
    const query = (blcontinue) => {
        return new Promise(resolve => {
            mw.request({
                action: 'query',
                list: 'backlinks',
                bltitle: pagetitle,
                bllimit: 'max',
                blcontinue: blcontinue,
                formatversion: '2'
            }).then(async (res) => {
                let resBL, resCont;
                if (!res || !res.query || !(resBL = res.query.backlinks))
                    return resolve((0, server_1.log)('getBackLinks: Query failed.'));
                const titles = resBL.filter(obj => !nsExclude.includes(obj.ns)).map(obj => obj.title);
                pages = pages.concat(titles);
                if (res && res.continue && (resCont = res.continue.blcontinue)) {
                    await query(resCont);
                }
                resolve(true);
            }).catch((err) => resolve((0, server_1.log)(err.info)));
        });
    };
    const result = await query();
    return result ? pages : undefined;
}
exports.getBackLinks = getBackLinks;
/**
 * Get pagetitles that belong to a given category
 * @param cattitle A 'Category:' prefix is automatically added if there's none
 * @param nsExclude An array of namespace numbers to exclude
 * @returns
 */
async function getCatMembers(cattitle, nsExclude) {
    if (!/^Category:/i.test(cattitle))
        cattitle = 'Category:' + cattitle;
    let cats = [];
    if (typeof nsExclude === 'undefined')
        nsExclude = [];
    const mw = (0, mw_1.getMw)();
    const query = (cmcontinue) => {
        return new Promise(resolve => {
            mw.request({
                action: 'query',
                list: 'categorymembers',
                cmtitle: cattitle,
                cmprop: 'title',
                cmlimit: 'max',
                cmcontinue: cmcontinue,
                formatversion: '2'
            }).then(async (res) => {
                let resCM, resCont;
                if (!res || !res.query || !(resCM = res.query.categorymembers))
                    return resolve((0, server_1.log)('getCatMembers: Query failed.'));
                const titles = resCM.filter(obj => !nsExclude.includes(obj.ns)).map(obj => obj.title);
                cats = cats.concat(titles);
                if (res && res.continue && (resCont = res.continue.cmcontinue)) {
                    await query(resCont);
                }
                resolve(true);
            }).catch((err) => resolve((0, server_1.log)(err.info)));
        });
    };
    const response = await query();
    const result = response ? cats : undefined;
    if (Array.isArray(result) && result.length === 0)
        (0, server_1.log)('No page belongs to ' + cattitle);
    return result;
}
exports.getCatMembers = getCatMembers;
/** Get a list of pages that transclude a given page. */
async function getTranscludingPages(pagetitle) {
    let pages = [];
    const mw = (0, mw_1.getMw)();
    const query = function (eicontinue) {
        return new Promise(resolve => {
            mw.request({
                action: 'query',
                list: 'embeddedin',
                eititle: pagetitle,
                eifilterredir: 'nonredirects',
                eilimit: 'max',
                eicontinue: eicontinue,
                formatversion: '2'
            }).then(async (res) => {
                let resEi, resCont;
                if (!res || !res.query || !(resEi = res.query.embeddedin))
                    return resolve();
                const titles = resEi.map(obj => obj.title);
                pages = pages.concat(titles);
                if (res && res.continue && (resCont = res.continue.eicontinue)) {
                    await query(resCont);
                }
                resolve();
            }).catch((err) => resolve((0, server_1.log)(err.info)));
        });
    };
    await query();
    return pages;
}
exports.getTranscludingPages = getTranscludingPages;
/** Filter protected pages out of a list of pagetitles. Returns undefined if any internal query fails. */
async function filterOutProtectedPages(pagetitles) {
    const mw = (0, mw_1.getMw)();
    const query = (pagetitlesArr) => {
        return new Promise(resolve => {
            mw.request({
                action: 'query',
                titles: pagetitlesArr.join('|'),
                prop: 'info',
                inprop: 'protection',
                formatversion: '2'
            }).then((res) => {
                let resPg;
                if (!res || !res.query || !(resPg = res.query.pages))
                    return resolve(undefined);
                const d = new Date();
                const isProtected = (prtArr) => {
                    return prtArr.some(function (obj) {
                        if (!obj.expiry)
                            return false;
                        if (obj.expiry.match(/^in/))
                            return true;
                        const protectedUntil = new Date(obj.expiry);
                        return d < protectedUntil;
                    });
                };
                const titles = resPg.filter(obj => {
                    let prtArr;
                    if (!obj.title)
                        return false;
                    if (!(prtArr = obj.protection) || prtArr.length === 0) {
                        return false;
                    }
                    else {
                        return isProtected(prtArr);
                    }
                }).map(obj => obj.title);
                resolve(titles);
            }).catch((err) => {
                (0, server_1.log)(err.info);
                resolve(undefined);
            });
        });
    };
    pagetitles = pagetitles.slice();
    const deferreds = [];
    while (pagetitles.length) {
        deferreds.push(query(pagetitles.splice(0, (0, mw_1.isBot)() ? 500 : 50)));
    }
    const result = await Promise.all(deferreds);
    const failed = result.some(el => !el);
    const protectedPages = result.flat().filter((el) => typeof el === 'string').filter((el, i, arr) => arr.indexOf(el) === i);
    return failed ? undefined : protectedPages;
}
exports.filterOutProtectedPages = filterOutProtectedPages;
/** Scrape a webpage. */
async function scrapeWebpage(url) {
    try {
        const res = await axios_1.default.get(url);
        const $ = cheerio.load(res.data);
        return $;
    }
    catch (err) {
        return (0, server_1.log)(err);
    }
}
exports.scrapeWebpage = scrapeWebpage;
/** Send an API request that automatically continues until the limit is reached. Works only for calls that have a 'continue' property in the response. */
function continuedRequest(params, limit = 10) {
    const mw = (0, mw_1.getMw)();
    const responses = [];
    const query = (params, count) => {
        return mw.request(params)
            .then((res) => {
            responses.push(res);
            if (res.continue && count < limit) {
                return query(Object.assign(params, res.continue), count + 1);
            }
            else {
                return responses;
            }
        }).catch((err) => {
            (0, server_1.log)(`continuedRequest: Request failed (reason: ${err.info}, loop count: ${count}).`);
            return responses;
        });
    };
    return query(params, 1);
}
exports.continuedRequest = continuedRequest;
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
function massRequest(params, batchParam, limit = (0, mw_1.isBot)() ? 500 : 50) {
    // Get the array to be used for the batch operation
    let batchArray;
    if (Array.isArray(batchParam)) {
        const sameArrayProvided = Object.keys(params)
            .filter(key => batchParam.includes(key))
            .map(key => params[key]) // Get multi-value fields as an array
            .every((multiValueFieldArray, i, arr) => {
            return Array.isArray(multiValueFieldArray) && arr.every(allMultiValueFieldArray => arraysEqual(multiValueFieldArray, allMultiValueFieldArray));
        });
        if (!sameArrayProvided)
            throw new Error('massRequest: Batch fields have different arrays.');
        batchArray = params[batchParam[0]];
    }
    else {
        batchArray = params[batchParam];
        if (!Array.isArray(batchArray))
            throw new Error('massRequest: Batch field in query must be an array.');
    }
    if (batchArray.length === 0) {
        const fieldNames = Array.isArray(batchParam) ? batchParam.join(', ') : batchParam;
        console.log(`massRequest: Batch field is an empty array. (${fieldNames})`);
        return Promise.resolve([]);
    }
    batchArray = batchArray.slice(); // Deep copy
    // Set the '**limit' parameter as 'max' if there's any
    const limitKey = Object.keys(params).filter((key) => /limit$/.test(key));
    if (limitKey.length !== 0 && [500, 50].includes(limit))
        params[limitKey[0]] = 'max';
    // Send API requests
    const mw = (0, mw_1.getMw)();
    const result = [];
    while (batchArray.length !== 0) {
        const splicedBatchArrayPiped = batchArray.splice(0, limit).join('|');
        if (typeof batchParam === 'string') {
            params[batchParam] = splicedBatchArrayPiped;
        }
        else {
            Object.keys(params).forEach(key => {
                if (batchParam.includes(key))
                    params[key] = splicedBatchArrayPiped;
            });
        }
        result.push(mw.request(params).then((res) => res).catch((err) => (0, server_1.log)(err.info)));
    }
    return Promise.all(result);
}
exports.massRequest = massRequest;
/**
 * Parse templates in wikitext. Templates within tags that prevent transclusions (i.e. \<!-- -->, nowiki, pre, syntaxhighlist, source) are not parsed.
 * @param wikitext
 * @param config
 * @param nestlevel Used module-internally. Don't specify this parameter manually.
 * @returns
 * @license siddharthvp@github - This function includes modifications from the original.
 * @link https://github.com/siddharthvp/mwn/blob/ccc6fb8/src/wikitext.ts#L77
 */
function parseTemplates(wikitext, config, nestlevel = 0) {
    // Initialize config
    config = Object.assign({
        recursive: true,
        namePredicate: null,
        templatePredicate: null
    }, config || {});
    // Number of unclosed braces
    let numUnclosed = 0;
    // Are we in a {{{parameter}}}, or between wikitags that prevent transclusions?
    let inParameter = false;
    let inTag = false;
    const tagNames = [];
    let parsed = [];
    let startIdx, endIdx;
    // Look at every character of the wikitext one by one. This loop only extracts the outermost templates.
    for (let i = 0; i < wikitext.length; i++) {
        const slicedWkt = wikitext.slice(i);
        let matchedTag;
        if (!inParameter && !inTag) {
            if (/^\{\{\{(?!\{)/.test(slicedWkt)) {
                inParameter = true;
                i += 2;
            }
            else if (/^\{\{/.test(slicedWkt)) {
                if (numUnclosed === 0) {
                    startIdx = i;
                }
                numUnclosed += 2;
                i++;
            }
            else if (/^\}\}/.test(slicedWkt)) {
                if (numUnclosed === 2) {
                    endIdx = i + 2;
                    const templateText = wikitext.slice(startIdx, endIdx); // Pipes could have been replaced with a control character if they're part of nested templates
                    const templateTextPipesBack = replacePipesBack(templateText);
                    parsed.push({
                        text: templateTextPipesBack,
                        name: capitalizeFirstLetter(templateTextPipesBack.replace(/^\{\{/, '').split(/\||\}/)[0].trim().replace(/^:?(template:|テンプレート:)/i, '').trim()),
                        arguments: parseTemplateArguments(templateText),
                        nestlevel: nestlevel
                    });
                }
                numUnclosed -= 2;
                i++;
            }
            else if (wikitext[i] === '|' && numUnclosed > 2) { // numUnclosed > 2 means we're in a nested template
                // Swap out pipes with \x01 character.
                wikitext = strReplaceAt(wikitext, i, '\x01');
            }
            else if ((matchedTag = slicedWkt.match(/^(?:<!--|<(nowiki|pre|syntaxhighlist|source) ?[^>]*?>)/))) {
                inTag = true;
                tagNames.push(matchedTag[1] ? matchedTag[1] : 'comment');
                i += matchedTag[0].length - 1;
            }
        }
        else {
            // we are in a {{{parameter}}} or tag 
            if (wikitext[i] === '|' && numUnclosed > 2) {
                wikitext = strReplaceAt(wikitext, i, '\x01');
            }
            else if ((matchedTag = slicedWkt.match(/^(?:-->|<\/(nowiki|pre|syntaxhighlist|source) ?[^>]*?>)/))) {
                inTag = false;
                tagNames.pop();
                i += matchedTag[0].length - 1;
            }
            else if (/^\}\}\}/.test(slicedWkt)) {
                inParameter = false;
                i += 2;
            }
        }
    }
    if (config) {
        // Get nested templates?
        if (config.recursive) {
            const subtemplates = parsed
                .map((template) => {
                return template.text.slice(2, -2);
            })
                .filter((templateWikitext) => {
                return /\{\{.*\}\}/s.test(templateWikitext);
            })
                .map((templateWikitext) => {
                return parseTemplates(templateWikitext, config, nestlevel + 1);
            })
                .flat();
            parsed = parsed.concat(subtemplates);
        }
        // Filter the array by template name(s)?
        if (config.namePredicate) {
            parsed = parsed.filter(({ name }) => config.namePredicate(name));
        }
        // Filter the array by a user-defined condition?
        if (config.templatePredicate) {
            parsed = parsed.filter((Template) => config.templatePredicate(Template));
        }
    }
    return parsed;
}
exports.parseTemplates = parseTemplates;
/**
 * This function should never be called externally because it presupposes that pipes in nested templates have been replaced with the control character '\x01',
 * and otherwise it doesn't work as expeceted.
 */
function parseTemplateArguments(template) {
    if (!template.includes('|'))
        return [];
    let innerContent = template.slice(2, -2); // Remove braces
    // Swap out pipes in links with \x01 control character
    // [[File: ]] can have multiple pipes, so might need multiple passes
    const wikilinkRegex = /(\[\[[^\]]*?)\|(.*?\]\])/g;
    while (wikilinkRegex.test(innerContent)) {
        innerContent = innerContent.replace(wikilinkRegex, '$1\x01$2');
    }
    const args = innerContent.split('|');
    args.shift(); // Remove template name
    let unnamedArgCount = 0;
    const parsedArgs = args.map((arg) => {
        // Replace {{=}}s with a (unique) control character
        // The magic words could have spaces before/after the equal sign in an inconsistent way
        // We need the input string back as it was before replacement, so mandane replaceAll isn't a solution here 
        const magicWordEquals = arg.match(/\{\{\s*=\s*\}\}/g) || [];
        magicWordEquals.forEach((equal, i) => arg = arg.replace(equal, `$EQ${i}`));
        let argName, argValue;
        const indexOfEqual = arg.indexOf('=');
        if (indexOfEqual >= 0) { // The argument is named
            argName = arg.slice(0, indexOfEqual).trim();
            argValue = arg.slice(indexOfEqual + 1).trim();
            if (argName === unnamedArgCount.toString())
                unnamedArgCount++;
        }
        else { // The argument is unnamed
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
        };
    });
    return parsedArgs;
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function strReplaceAt(string, index, char) {
    return string.slice(0, index) + char + string.slice(index + 1);
}
function replacePipesBack(string) {
    // eslint-disable-next-line no-control-regex
    return string.replace(/\x01/g, '|');
}
/**
 * Parse a plain text and extract html tags in it, including \<!-- --> tags. This function is fast because it doesn't involve parsing into DOM.
 * @param html
 * @param config
 * @returns
 */
function parseHtml(html, config) {
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
    const tags = []; // All elements are pushed into the beginning of the array in the loop below (unshift)
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
        }
        else {
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
                }
                else if ((matched = slicedHtml.match(closingTagRegex))) {
                    i += matched[0].length - 1; // Just skip
                }
                // Inside some other tags
            }
            else {
                // Start of a new tag (nested tag); same as when not nested
                if ((matched = slicedHtml.match(openingTagRegex))) {
                    tags.unshift({
                        name: matched[1] ? matched[1].toLowerCase() : 'comment',
                        startIdx: i,
                        selfclosingIdx: i + matched[0].length
                    });
                    i += matched[0].length - 1;
                    // End of a tag
                }
                else if ((matched = slicedHtml.match(closingTagRegex))) {
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
                        }
                        else { // There's a <br> for the </p>; <br> closes itself, neccesary to retrieve the start and end indexes from the saved tag object
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
            parsed = parsed.filter(({ name }) => config.namePredicate(name));
        }
        // Filter the array by a user-defined condition?
        if (config.htmlPredicate) {
            parsed = parsed.filter((Html) => config.htmlPredicate(Html));
        }
    }
    return parsed;
}
exports.parseHtml = parseHtml;
/**
 * Get strings enclosed by \<!-- -->, \<nowiki />, \<pre />, \<syntaxhighlight />, and \<source />, not including those nested
 * inside other occurrences of these tags.
 */
function getCommentTags(wikitext) {
    const namePredicate = (name) => {
        return ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source'].includes(name);
    };
    const commentTags = parseHtml(wikitext, { namePredicate: namePredicate })
        .filter((Html, i, arr) => {
        // Get rid of comment tags that are nested inside bigger comment tags
        return !arr.some((Html2) => Html2.index.start < Html.index.start && Html.index.end < Html2.index.end);
    })
        .map((Html) => Html.text);
    return commentTags;
}
exports.getCommentTags = getCommentTags;
/**
 * Replace strings by given strings in a wikitext, ignoring replacees in tags that prevent transclusions (i.e. \<!-- -->, nowiki, pre, syntaxhighlist, source).
 * The replacees array and the replacers array must have the same number of elements in them. This restriction does not apply only if the replacees are to be
 * replaced with one unique replacer, and the 'replacers' argument is a string or an array containing only one element.
 */
function replaceWikitext(wikitext, replacees, replacers) {
    let replacersArr = [];
    if (typeof replacers === 'string') {
        replacersArr.push(replacers);
    }
    else {
        replacersArr = replacers.slice(); // Deep copy
    }
    if (replacees.length !== replacersArr.length && replacersArr.length === 1) {
        replacees.forEach((el, i) => {
            if (i === 0)
                return;
            replacersArr.push(replacersArr[0]);
        });
    }
    if (replacees.length !== replacersArr.length)
        throw 'replaceWikitext: replacees and replacers must have the same number of elements in them.';
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
exports.replaceWikitext = replaceWikitext;
/** Parse the content of a page into that of each section. */
function parseSections(content) {
    const regex = {
        header: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/,
        headerG: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/g,
        headerEquals: /(?:^={2,5}[^\S\n\r]*|[^\S\n\r]*={2,5}$)/g
    };
    // Get headers and exclude those in comment tags
    const matched = content.match(regex.headerG);
    let headers = matched ? matched.slice() : [];
    getCommentTags(content).forEach(co => {
        headers = headers.filter(header => !co.includes(header));
    });
    headers.unshift(''); // For the top section
    // Create an array of objects
    const sections = headers.map((header, i, arr) => {
        const isTopSection = i === 0;
        return {
            header: isTopSection ? null : header,
            title: isTopSection ? null : header.replace(regex.headerEquals, ''),
            level: isTopSection ? 1 : header.match(/=/g).length / 2,
            index: i,
            content: isTopSection ? (arr.length > 1 ? content.split(headers[1])[0] : content) : '',
            deepest: isTopSection ? null : false
        };
    });
    // Get the content property
    sections.forEach((obj, i, arr) => {
        // For top section
        if (!obj.header)
            return;
        // Check if there's any section of the same level or shallower following this section
        const nextBoundarySection = arr.slice(i + 1).find(objF => objF.level <= obj.level);
        // Get the content of this section
        let sectionContent;
        if (nextBoundarySection) {
            sectionContent = content.substring(content.indexOf(obj.header), content.indexOf(nextBoundarySection.header));
        }
        else {
            sectionContent = content.substring(content.indexOf(obj.header));
        }
        obj.content = sectionContent;
        obj.deepest = typeof arr.slice(i + 1).find(objF => sectionContent.includes(objF.header)) === 'undefined';
    });
    return sections;
}
exports.parseSections = parseSections;
/**
 * Parse links in a given wikitext.
 * @param wikitext Wikitext to parse.
 * @param pagetitle Namespace-prefixed title to parse. Supplemented if the link starts with '#' (page-internal section link) or '/' (subpage link).
 * Expect an incomplete result when not providing any.
 * @param linkPredicate Predicate to filter out the result.
 * @returns
 */
function parseLinks(wikitext, pagetitle, linkPredicate) {
    const rawLinks = [];
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
            }
            else if (wikitext[i] === '[') {
                startIdx = i;
                inLink = true;
            }
        }
        else {
            if (wikitext[i] === ']' && numUnclosed !== 0) {
                numUnclosed--;
            }
            else if (wikitext[i] === '[') { // Nested ungrammatical link
                numUnclosed++;
            }
            else if (/^\]\]/.test(slicedWkt)) {
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
            }
            else if (wikitext[i] === ']') {
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
    if (rawLinks.length === 0)
        return [];
    // Parse the links
    let links = rawLinks.map(({ text, external, inclusive }) => {
        // Remove the leading and trailing bracket(s)
        let linkTrunc = external ? text.slice(1, -1) : text.slice(2, -2);
        // Get templates inside the link and replace pipes/spaces in them with a control character
        const templates = parseTemplates(linkTrunc, { templatePredicate: (Template) => Template.nestlevel === 0 }).map(Template => Template.text);
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
        }
        else {
            const params = linkTrunc.split('|').map(el => el.trim().replace(/\\x01/g, '|'));
            let isFragment = ['#', '/'].includes(params[0][0]);
            if (pagetitle && isFragment) {
                params[0] = pagetitle + params[0];
                isFragment = false;
            }
            const isColoned = params[0][0] === ':';
            const isFile = /\bfile:/i.test(params[0]);
            const displayedText = isFile ? params.slice(1) : (params.length === 1 ? params[0].replace(/^:/, '') : params.slice(1).join('|')) + inclusive;
            const colonArr = params[0].split(':').filter(el => el); // Split the link target by colon and remove empty strings
            const prefixes = colonArr.filter(el => siteinfo.projectPrefixes.includes(el.toLowerCase())).map(el => el.toLowerCase());
            const isInterwiki = prefixes.length !== 0;
            // Get the link target's namespace
            const nsIdx = colonArr.findIndex(el => siteinfo.namespaces.includes(el.toLowerCase().replace(/ /g, '_')));
            let nsId = '0';
            let ns = '';
            if (nsIdx !== -1) {
                const key = colonArr[nsIdx].toLowerCase().replace(/ /g, '_');
                nsId = siteinfo.namespaceIds[key].toString();
                ns = siteinfo.normalizedNamespaces[nsId];
            }
            // Get title and section
            let m;
            const section = ((m = params[0].match(/#.+/))) ? m[0] : m;
            const prefixRegex = new RegExp(`^:?${prefixes.length !== 0 ? prefixes.join(':') + ':' : ''}`);
            let title = colonArr.slice(nsIdx + 1).join(':').replace(prefixRegex, '');
            if (section)
                title = title.replace(section, '');
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
            }
            else {
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
exports.parseLinks = parseLinks;
/**
 * @param timestamp1
 * @param timestamp2
 * @param rewind5minutes if true, rewind timestamp1 by 5 minutes
 * @returns timestamp2 - timestamp1 (in milliseconds)
 */
function compareTimestamps(timestamp1, timestamp2, rewind5minutes) {
    const ts1 = new Date(timestamp1);
    if (rewind5minutes)
        ts1.setMinutes(ts1.getMinutes() - 5);
    const ts2 = new Date(timestamp2);
    const diff = ts2.getTime() - ts1.getTime();
    return diff;
}
exports.compareTimestamps = compareTimestamps;
/** Get a JSON timestamp of the current time. Milliseconds omitted. */
function getCurTimestamp() {
    return new Date().toJSON().split('.')[0] + 'Z';
}
exports.getCurTimestamp = getCurTimestamp;
/**
 * Subtract timestamp2 by timestamp1 and output the resultant duration in Japanese.
 * If the time difference is a negative value, undefined is returned.
 */
function getDuration(timestamp1, timestamp2) {
    const ts1 = new Date(timestamp1);
    const ts2 = new Date(timestamp2);
    const diff = ts2.getTime() - ts1.getTime();
    if (diff < 0)
        return;
    let seconds = Math.floor(diff / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    let weeks = Math.floor(days / 7);
    let months = Math.floor(days / 30);
    let years = Math.floor(days / 365);
    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    days %= 30;
    weeks %= 7;
    months %= 30;
    years %= 365;
    let duration, unit;
    if (years) {
        duration = years;
        unit = '年';
    }
    else if (months) {
        duration = months;
        unit = 'か月';
    }
    else if (weeks) {
        duration = weeks;
        unit = '週間';
    }
    else if (days) {
        duration = days;
        unit = '日';
    }
    else if (hours) {
        duration = hours;
        unit = '時間';
    }
    else if (minutes) {
        duration = minutes;
        unit = '分';
    }
    else {
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
exports.getDuration = getDuration;
/** Escapes \ { } ( ) . ? * + - ^ $ [ ] | (but not '!'). */
function escapeRegExp(str) {
    return str.replace(/[\\{}().?*+\-^$[\]|]/g, '\\$&');
}
exports.escapeRegExp = escapeRegExp;
/**
 * Get the last day of a given month.
 * @param year
 * @param month 1-12
 */
function lastDay(year, month) {
    if (typeof year === 'string')
        year = parseInt(year);
    if (typeof month === 'string')
        month = parseInt(month);
    return new Date(year, month, 0).getDate();
}
exports.lastDay = lastDay;
/** Get the Japanese name of a day of the week from JSON timestamp. */
function getWeekDayJa(timestamp) {
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    return daysOfWeek[new Date(timestamp).getDay()];
}
exports.getWeekDayJa = getWeekDayJa;
/** Check whether a given string is an IP address. */
function isIPAddress(ip) {
    return net_1.default.isIP(ip) || (0, is_cidr_1.default)(ip);
}
exports.isIPAddress = isIPAddress;
/** Check whether a given string is an IPv4 address. */
function isIPv4Address(ip) {
    return net_1.default.isIPv4(ip) || (0, is_cidr_1.v4)(ip);
}
exports.isIPv4Address = isIPv4Address;
/** Check whether a given string is an IPv6 address. */
function isIPv6Address(ip) {
    return net_1.default.isIPv6(ip) || (0, is_cidr_1.v6)(ip);
}
exports.isIPv6Address = isIPv6Address;
/** Split a string into two at the first (or last if bottomup === true) occurrence of a delimiter. If the passed string doesn't contain the delimiter, either the first (bottomup) or the second (!bottomup) element will be an empty string. The delimiter between the two segments won't be included in them. */
function split2(str, delimiter, bottomup) {
    const chunks = str.split(delimiter);
    if (bottomup) {
        return [chunks.pop(), chunks.join(delimiter)].reverse();
    }
    else {
        return [chunks.shift(), chunks.join(delimiter)];
    }
}
exports.split2 = split2;
/** Check whether two arrays are equal. Neither array should contain objects nor other arrays. */
function arraysEqual(array1, array2, orderInsensitive = false) {
    if (orderInsensitive) {
        return array1.every(el => array2.includes(el)) && array1.length === array2.length;
    }
    else {
        return array1.every((el, i) => array2[i] === el) && array1.length === array2.length;
    }
}
exports.arraysEqual = arraysEqual;
