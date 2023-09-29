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
exports.arraysDiff = exports.arraysEqual = exports.isIPv6Address = exports.isIPv4Address = exports.isIPAddress = exports.getWeekDayJa = exports.lastDay = exports.escapeRegExp = exports.getCurTimestamp = exports.compareTimestamps = exports.clean = exports.massRequest = exports.continuedRequest = exports.scrapeWebpage = exports.searchText = exports.getEmbeddedIn = exports.getCatMembers = exports.getBackLinks = exports.edit = exports.sleep = void 0;
const mw_1 = require("./mw");
const server_1 = require("./server");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const title_1 = require("./title");
const net_1 = __importDefault(require("net"));
const is_cidr_1 = __importStar(require("is-cidr"));
// ****************************************** ASYNCHRONOUS FUNCTIONS ******************************************
/**
 * Let the code sleep for n milliseconds.
 * @param milliseconds The milliseconds to sleep. If a negative number is passed, it is automatically rounded up to `0`.
 * @returns
 */
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
}
exports.sleep = sleep;
let lastedit;
let tokenExpired;
/**
 * Edit a given page. If the edit fails because of an expired token, another edit attempt is automatically made after re-login.
 *
 * @param params Automatically added params: `{ action: 'edit', token: mw.editToken, formatversion: '2' }`
 * @param autoInterval Ensure a 5 second interval since the last edit, defaulted to `true`.
 * @returns A boolean value indicating whether the edit succeeded, or `null` if a second edit attempt failed.
 */
async function edit(params, autoInterval = true) {
    // Initialize the request parameters
    let mw = (0, mw_1.getMw)();
    Object.assign(params, {
        action: 'edit',
        token: mw.editToken,
        formatversion: '2'
    });
    if (tokenExpired) {
        tokenExpired = null;
    }
    else {
        tokenExpired = false;
    }
    // Make sure that it's been more than 5 seconds since the last edit
    if (lastedit && autoInterval) {
        const diff = compareTimestamps(lastedit, new Date().toJSON());
        await sleep(4600 - diff);
    }
    // Edit the page
    (0, server_1.log)(`Editing ${params.title}...`);
    /** `true` on success, `false` on failure by a known error, `null` on failure by an unknown error. */
    const result = await mw.request(params)
        .then((res) => {
        return res && res.edit && res.edit.result === 'Success' || null;
    })
        .catch((err) => {
        if (err)
            (0, server_1.log)(err);
        if (tokenExpired === false && err && err.info.includes('Invalid CSRF token')) {
            tokenExpired = true;
        }
        return false;
    });
    // Process result
    switch (result) {
        case true:
            (0, server_1.log)(params.title + ': Edit done.');
            lastedit = new Date().toJSON();
            return true;
        case null:
            (0, server_1.log)(params.title + ': Edit failed due to an unknown error.');
            return false;
        case false:
            (0, server_1.log)(`${params.title}: Edit failed`);
            if (!tokenExpired) {
                return null;
            } // Continue otherwise
    }
    // Error handler for the expired token
    (0, server_1.log)('Edit token seems to have expired. Relogging in...');
    mw = await (0, mw_1.init)();
    if (!mw)
        return null;
    Object.assign(params, { token: mw.editToken });
    return await edit(params, autoInterval);
}
exports.edit = edit;
/**
 * Get an array of pagetitles are linked to a given page. Transclusions are not included.
 * @param pagetitle
 * @param options
 * @returns Always a string array even if some internal API request failed.
 */
async function getBackLinks(pagetitle, options) {
    const params = {
        action: 'query',
        list: 'backlinks',
        bltitle: pagetitle,
        bllimit: 'max',
        formatversion: '2'
    };
    Object.assign(params, options || {});
    const response = await continuedRequest(params, Infinity);
    return response.reduce((acc, res) => {
        const resBkl = res && res.query && res.query.backlinks;
        if (resBkl) {
            acc = acc.concat(resBkl.map(({ title }) => title));
        }
        return acc;
    }, []);
}
exports.getBackLinks = getBackLinks;
/**
 * Get pagetitles that belong to a given category.
 * @param cattitle A 'Category:' prefix is automatically added if there's none
 * @param options
 * @returns Always a string array even if some internal API request failed.
 */
async function getCatMembers(cattitle, options) {
    if (!/^Category:/i.test(cattitle)) {
        cattitle = 'Category:' + cattitle;
    }
    const params = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: cattitle,
        cmprop: 'title',
        cmlimit: 'max',
        formatversion: '2'
    };
    Object.assign(params, options || {});
    const response = await continuedRequest(params, Infinity);
    return response.reduce((acc, res) => {
        const resCm = res && res.query && res.query.categorymembers;
        if (resCm) {
            acc = acc.concat(resCm.map(({ title }) => title));
        }
        return acc;
    }, []);
}
exports.getCatMembers = getCatMembers;
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
async function getEmbeddedIn(pagetitle, options) {
    const params = {
        action: 'query',
        list: 'embeddedin',
        eititle: pagetitle,
        eilimit: 'max',
        formatversion: '2'
    };
    Object.assign(params, options || {});
    const response = await continuedRequest(params, Infinity);
    return response.reduce((acc, res) => {
        const resEmb = res && res.query && res.query.embeddedin;
        if (resEmb) {
            acc = acc.concat(resEmb.map(({ title }) => title));
        }
        return acc;
    }, []);
}
exports.getEmbeddedIn = getEmbeddedIn;
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
async function searchText(condition, namespace) {
    const params = {
        action: 'query',
        list: 'search',
        srsearch: condition,
        srnamespace: namespace || '0',
        srlimit: 'max',
        srwhat: 'text',
        formatversion: '2'
    };
    const response = await continuedRequest(params, Infinity);
    return response.reduce((acc, res) => {
        const resSr = res && res.query && res.query.search;
        if (resSr) {
            acc = acc.concat(resSr.map(({ title }) => title));
        }
        return acc;
    }, []);
}
exports.searchText = searchText;
/**
 * Scrape a webpage.
 * @param url
 * @returns `null` on failure.
 */
async function scrapeWebpage(url) {
    try {
        const res = await axios_1.default.get(url);
        const $ = cheerio.load(res.data);
        return $;
    }
    catch (err) {
        (0, server_1.log)(err);
        return null;
    }
}
exports.scrapeWebpage = scrapeWebpage;
/**
 * Send an API request that automatically continues until the limit is reached. Works only for calls that have a 'continue' property in the response.
 * @param params
 * @param limit Default: 10
 * @returns The returned array might have `null` elements if any internal API request failed.
 */
function continuedRequest(params, limit = 10) {
    const mw = (0, mw_1.getMw)();
    const responses = [];
    const query = (params, count) => {
        return mw.request(params)
            .then((res) => {
            responses.push(res || null);
            if (res.continue && count < limit) {
                return query(Object.assign(params, res.continue), count + 1);
            }
            else {
                return responses;
            }
        }).catch((err) => {
            (0, server_1.log)(`continuedRequest: Request failed (reason: ${err.info}, loop count: ${count}).`);
            responses.push(null);
            return responses;
        });
    };
    return query(params, 1);
}
exports.continuedRequest = continuedRequest;
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
 * @param batchParam
 * The name of the multi-value field (can be an array).
 * @param apilimit
 * Optional splicing number (default: `500/50`). The `**limit` parameter, if there is any, is automatically set to `max`
 * if this argument has the value of either `500` or `50`. It also accepts a unique value like `1`, in cases such as
 * {@link https://www.mediawiki.org/w/api.php?action=help&modules=query%2Bblocks |list=blocks} with a `bkip` parameter
 * (which only allows one IP to be specified).
 * @returns
 * Always an array: Elements are either `ApiResponse` (success) or `null` (failure). If the multi-value field is an empty array,
 * the return array will also be empty.
 */
function massRequest(params, batchParams, apilimit = (0, mw_1.isBot)() ? 500 : 50) {
    // Initialize variables
    params = Object.assign({}, params);
    const nonArrayBatchParams = [];
    // Get the array to be used for the batch operation
    const batchKeys = Array.isArray(batchParams) ? batchParams : [batchParams];
    const batchArrays = Object.keys(params).reduce((acc, key) => {
        if (batchKeys.includes(key)) {
            if (Array.isArray(params[key])) {
                acc.push(params[key].slice());
            }
            else {
                nonArrayBatchParams.push(key);
            }
        }
        else if (/limit$/.test(key) && (apilimit === 500 || apilimit === 50)) {
            // If this is a '**limit' parameter and the value is the default one, set it to 'max'
            params[key] = 'max';
        }
        return acc;
    }, []);
    if (nonArrayBatchParams.length) {
        throw new Error('The batch param(s) (' + nonArrayBatchParams.join(', ') + ') must be arrays.');
    }
    else if (!batchKeys.length) {
        throw new Error('There is a problem with the value of the "batchParams" parameter.');
    }
    else if (!batchArrays.length) {
        throw new Error('The passed API params do not contain arrays for the batch operation.');
    }
    else if (batchArrays.length > 1 && !batchArrays.slice(1).every((arr) => arraysEqual(batchArrays[0], arr))) {
        throw new Error('The arrays passed for the batch operation must all be non-distinct with each other.');
    }
    // Final check
    const batchArray = batchArrays[0];
    if (!batchArray.length) {
        console.log('An empty array has been passed for the batch operation.');
        return Promise.resolve([]);
    }
    // Send API requests
    const mw = (0, mw_1.getMw)();
    const req = (reqParams) => {
        return mw.request(reqParams)
            .then((res) => res || null)
            .catch((err) => {
            (0, server_1.log)(err && err.info || 'mw.request reached the catch block.');
            return null;
        });
    };
    const result = [];
    while (batchArray.length !== 0) {
        const batchArrayStr = batchArray.splice(0, apilimit).join('|');
        Object.assign(// Overwrite the batch parameters with a stringified batch array 
        params, batchKeys.reduce((acc, key) => {
            acc[key] = batchArrayStr;
            return acc;
        }, Object.create(null)));
        result.push(req(params));
    }
    return Promise.all(result);
}
exports.massRequest = massRequest;
// ****************************************** SYNCHRONOUS FUNCTIONS ******************************************
/**
 * Remove unicode bidirectional characters and leading/trailing `\s`s from a string.
 *
 * @param str Input string.
 * @param trim Whether to trim `str`, defaulted to `true`.
 * @returns
 */
function clean(str, trim = true) {
    str = str.replace(title_1.rUnicodeBidi, '');
    return trim ? str.trim() : str;
}
exports.clean = clean;
/**
 * Compare two JSON timestamps and get the difference between them in milliseconds.
 * @param earlierTimestamp
 * @param laterTimestamp
 * @param rewindMilliseconds If provided, subtract `earlierTimestamp` by this value (only accepts a positive number).
 * This makes it possible to specify a time earlier than the time represented by `earlierTimestamp`.
 * @returns `laterTimestamp` subtracted by `earlierTimestamp` (in milliseconds). Can be a negative number.
 */
function compareTimestamps(earlierTimestamp, laterTimestamp, rewindMilliseconds) {
    const ts1 = earlierTimestamp instanceof Date ? earlierTimestamp : new Date(earlierTimestamp);
    if (typeof rewindMilliseconds === 'number') {
        ts1.setMilliseconds(ts1.getMilliseconds() - Math.max(0, rewindMilliseconds));
    }
    const ts2 = laterTimestamp instanceof Date ? laterTimestamp : new Date(laterTimestamp);
    return ts2.getTime() - ts1.getTime();
}
exports.compareTimestamps = compareTimestamps;
/**
 * Get a JSON timestamp of the current time. Milliseconds omitted.
 * @param omitMilliseconds
 * Whether to omit the milliseconds (`2100-01-01T00:00:00Z` instead of `2100-01-01T00:00:00.000Z`).
 *
 * Default: `true`
 * @returns
 */
function getCurTimestamp(omitMilliseconds = true) {
    const ts = new Date().toJSON();
    return omitMilliseconds ? ts.split('.')[0] + 'Z' : ts;
}
exports.getCurTimestamp = getCurTimestamp;
/**
 * Escapes `\ { } ( ) . ? * + - ^ $ [ ] |` (but not `!`).
 * @param str
 * @returns
 */
function escapeRegExp(str) {
    return str.replace(/[\\{}().?*+\-^$[\]|]/g, '\\$&');
}
exports.escapeRegExp = escapeRegExp;
/**
 * Get the last day of a given month.
 * @param year
 * @param month 1-12
 * @returns 28-31
 */
function lastDay(year, month) {
    return new Date(year, month, 0).getDate();
}
exports.lastDay = lastDay;
/**
 * Get the Japanese name of a day of the week.
 * @param date A JSON timestamp or a Date instance.
 * @returns
 */
function getWeekDayJa(date) {
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    const d = date instanceof Date ? date : new Date(date);
    return daysOfWeek[d.getDay()];
}
exports.getWeekDayJa = getWeekDayJa;
/**
 * Check whether a given string is an IP address.
 * @param ip
 * @param allowBlock Whether to allow a CIDR address.
 * @returns
 */
function isIPAddress(ip, allowBlock = false) {
    return !!net_1.default.isIP(ip) || allowBlock && !!(0, is_cidr_1.default)(ip);
}
exports.isIPAddress = isIPAddress;
/**
 * Check whether a given string is an IPv4 address.
 * @param ip
 * @param allowBlock Whether to allow a CIDR address.
 * @returns
 */
function isIPv4Address(ip, allowBlock = false) {
    return net_1.default.isIPv4(ip) || allowBlock && (0, is_cidr_1.v4)(ip);
}
exports.isIPv4Address = isIPv4Address;
/**
 * Check whether a given string is an IPv6 address.
 * @param ip
 * @param allowBlock Whether to allow a CIDR address.
 * @returns
 */
function isIPv6Address(ip, allowBlock = false) {
    return net_1.default.isIPv6(ip) || allowBlock && (0, is_cidr_1.v6)(ip);
}
exports.isIPv6Address = isIPv6Address;
/**
 * Check whether two arrays are equal. Neither array should contain non-primitive values as its elements.
 * @param array1
 * @param array2
 * @param orderInsensitive Default: `false`
 * @returns
 */
function arraysEqual(array1, array2, orderInsensitive = false) {
    if (orderInsensitive) {
        return array1.length === array2.length && array1.every(el => array2.includes(el));
    }
    else {
        return array1.length === array2.length && array1.every((el, i) => array2[i] === el);
    }
}
exports.arraysEqual = arraysEqual;
/**
 * Compare elements in two arrays and get differences.
 * @param sourceArray
 * @param targetArray
 * @returns
 */
function arraysDiff(sourceArray, targetArray) {
    const added = [];
    const removed = [];
    sourceArray.forEach((el) => {
        if (!targetArray.includes(el))
            removed.push(el);
    });
    targetArray.forEach((el) => {
        if (!sourceArray.includes(el))
            added.push(el);
    });
    return { added, removed };
}
exports.arraysDiff = arraysDiff;
