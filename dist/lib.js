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
exports.isIPv6 = exports.isIPv4 = exports.isIPAddress = exports.getWeekDayJa = exports.lastDay = exports.escapeRegExp = exports.getDuration = exports.compareTimestamps = exports.parseContentBySection = exports.replaceWikitext = exports.parseHtml = exports.parseTemplates = exports.getOpenUserANs = exports.getTemplateParams = exports.extractCommentOuts = exports.findHtmlTags = exports.findTemplates = exports.scrapeUsernameFromLogid = exports.scrapeWebpage = exports.filterOutProtectedPages = exports.getTranscludingPages = exports.getCatMembers = exports.getBackLinks = exports.edit = exports.sleep = exports.getLatestRevision = void 0;
const net_1 = __importDefault(require("net"));
const is_cidr_1 = __importStar(require("is-cidr"));
const cheerio = __importStar(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
const server_1 = require("./server");
const mw_1 = require("./mw");
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
 * @param arams
 * @param autoInterval True by default
 * @param retry Automatically set to true for a second edit attempt after re-login. Don't specify this parameter manually.
 * @returns apiReponse (null if a second edit attempt fails or if the mwbot instance fails to be initialized)
 */
async function edit(params, autoInterval = true, retry) {
    // Initialize the request parameters
    let mw = (0, mw_1.getMw)();
    params = Object.assign(params, {
        action: 'edit',
        token: mw.editToken,
        curtimestamp: true,
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
    params = Object.assign(params, { token: mw.editToken });
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
 * @param cattitle Must start with 'Category:' but automatically added
 * @param nsExclude An array of namespace numbers to exclude
 * @returns
 */
async function getCatMembers(cattitle, nsExclude) {
    if (cattitle && !cattitle.match(/^Category:/))
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
    const protectedPages = result.flat().filter((el) => typeof el === 'string').undup();
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
/** Get a username from an account creation logid. */
async function scrapeUsernameFromLogid(logid) {
    const url = 'https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AD%E3%82%B0&logid=' + logid;
    const $ = await scrapeWebpage(url);
    if (!$)
        return;
    let $newusers = $('.mw-logline-newusers');
    if ($newusers.length === 0)
        return;
    $newusers = $newusers.eq(0);
    let username;
    switch ($newusers.attr('data-mw-logaction')) {
        case 'newusers/create':
        case 'newusers/autocreate':
        case 'newusers/create2': // Created by an existing user
        case 'newusers/byemail': // Created by an existing user and password sent off
            username = $newusers.children('a.mw-userlink').eq(0).text();
            break;
        case 'newusers/forcecreatelocal':
            username = $newusers.children('a').last().text().replace(/^利用者:/, '');
            break;
        default:
    }
    return username;
}
exports.scrapeUsernameFromLogid = scrapeUsernameFromLogid;
// ****************************** SYNCHRONOUS FUNCTIONS ******************************
/**
 * Extract templates from wikitext.
 * @param wikitext
 * @param templateName Filter out templates by these names.
 * @param templatePrefix Filter out templates by these name prefixes.
 * @returns
 */
function findTemplates(wikitext, templateName, templatePrefix) {
    // Remove comments
    extractCommentOuts(wikitext).forEach(co => {
        const regex = new RegExp(escapeRegExp(co) + '\\s?');
        wikitext = wikitext.replace(regex, '');
    });
    // Create an array by splitting the original content with '{{'
    const tempInnerContents = wikitext.split('{{'); // Note: tempInnerContents[0] is always an empty string or a string that has nothing to do with templates
    if (tempInnerContents.length === 0)
        return [];
    // Extract templates from the wikitext
    const nest = [];
    let templates = tempInnerContents.reduce((acc, tempInnerContent, i, arr) => {
        if (i === 0)
            return acc;
        let temp;
        const tempTailCnt = (tempInnerContent.match(/\}\}/g) || []).length; // The number of '}}' in the split array
        // There's no '}}' (= nesting other templates)
        if (tempTailCnt === 0) {
            nest.push(i); // Save the index of the element in the array
            // There's one '}}' in the element of the array (= the left part of '}}' is the whole of the template's parameters)
        }
        else if (tempTailCnt === 1) {
            temp = '{{' + tempInnerContent.split('}}')[0] + '}}';
            if (!acc.includes(temp))
                acc.push(temp);
            // There're two or more '}}'s (e.g. 'TL2|...}}...}}'; = templates are nested)
        }
        else {
            for (let j = 0; j < tempTailCnt; j++) {
                if (j === 0) { // The innermost template
                    temp = '{{' + tempInnerContent.split('}}')[j] + '}}'; // Same as when there's one '}}' in the element
                    if (!acc.includes(temp))
                        acc.push(temp);
                }
                else { // Multi-nested template(s)
                    const elNum = nest[nest.length - 1]; // The index of the element that involves the start of the nest
                    nest.pop(); // The index won't be reused after reference
                    const nestedTempInnerContent = tempInnerContent.split('}}'); // Create another array by splitting with '}}'
                    temp = '{{' + arr.slice(elNum, i).join('{{') + '{{' + nestedTempInnerContent.slice(0, j + 1).join('}}') + '}}';
                    if (!acc.includes(temp))
                        acc.push(temp);
                }
            }
        }
        return acc;
    }, []); // All templates in the wikitext is stored in 'templates' when the loop is done
    // End here if the templates don't need to be sorted
    if ((!templateName && !templatePrefix) || templates.length === 0)
        return templates;
    // Convert passed parameters to arrays if they are strings
    if (templateName && typeof templateName === 'string')
        templateName = [templateName];
    if (templatePrefix && typeof templatePrefix === 'string')
        templatePrefix = [templatePrefix];
    /**
     * Create a regex string that makes a certain character case-insensitive.
     * @param str
     * @returns [Xx]
     */
    const getCaseInsensitiveCharacterRegex = (str) => '[' + str.substring(0, 1).toUpperCase() + str.substring(0, 1).toLowerCase() + ']';
    // Create regex for template sorting
    const names = [], prefixes = [];
    let templateNameRegExp;
    let templatePrefixRegExp;
    if (templateName) {
        for (let i = 0; i < templateName.length; i++) {
            names.push(getCaseInsensitiveCharacterRegex(templateName[i]) + escapeRegExp(templateName[i].substring(1)));
        }
        templateNameRegExp = new RegExp('^(' + names.join('|') + ')$');
    }
    if (templatePrefix) {
        for (let i = 0; i < templatePrefix.length; i++) {
            prefixes.push(getCaseInsensitiveCharacterRegex(templatePrefix[i]) + escapeRegExp(templatePrefix[i].substring(1)));
        }
        templatePrefixRegExp = new RegExp('^(' + prefixes.join('|') + ')');
    }
    // Sort out certain templates
    let errHandler = false;
    templates = templates.filter(item => {
        const head = item.match(/^\{{2}\s*([^|{}\n]+)/);
        if (!head) {
            errHandler = true;
            return false;
        }
        const name = head[1].trim(); // {{ TEMPLATENAME | ... }} の TEMPLATENAME を抽出
        if (templateName && templatePrefix) {
            return name.match(templateNameRegExp) || name.match(templatePrefixRegExp);
        }
        else if (templateName) {
            return name.match(templateNameRegExp);
        }
        else if (templatePrefix) {
            return name.match(templatePrefixRegExp);
        }
    });
    if (errHandler)
        (0, server_1.log)('findTemplates: Detected unprocessable braces.');
    return templates;
}
exports.findTemplates = findTemplates;
/**
 * Find all HTML tags in a string, including innerHTML.
 * @param content String in which to search for tags
 * @param tagnames Tags to return
 * @returns Array of outerHTMLs
 */
function findHtmlTags(content, tagnames) {
    // Remove comments
    extractCommentOuts(content).forEach(co => {
        const regex = new RegExp(escapeRegExp(co) + '\\s?');
        content = content.replace(regex, '');
    });
    // Get all <tag> and </tag>s and create an array of objects
    const regex = /(?:<[^\s/>]+[^\S\r\n]*[^>]*>|<\/[^\S\r\n]*[^\s>]+[^\S\r\n]*>)/g;
    const mArr = [];
    let m;
    while ((m = regex.exec(content))) {
        const type = m[0].match(/^<[^\S\r\n]*\//) ? 'end' : 'start';
        mArr.push({
            tag: m[0],
            tagname: m[0].match(/^<\/?[^\S\r\n]*([^\s>]+)[^\S\r\n]*[^>]*>$/)[1],
            type: type,
            index: m.index // Index of the tag in the content
        });
    }
    let nestCnt = 0;
    let tags = [];
    mArr.forEach((obj, i, arr) => {
        if (obj.type === 'end')
            return; // Loop through all opening tags
        if (!arr[i + 1])
            return;
        arr.filter((fObj, fi) => i < fi && fObj.tagname === obj.tagname).some(sObj => {
            if (sObj.type === obj.type) { // If there's a starting tag, that's a nested tag (e.g. <div2> in <div> ... <div2> ... </div>)
                nestCnt++;
                return false; // Continue the loop
            }
            else if (sObj.type !== obj.type && nestCnt !== 0) { // If there's a closing tag and if it's for a nested opening tag
                nestCnt--;
                return false; // Continue the loop
            }
            else if (sObj.type !== obj.type && nestCnt === 0) { // If there's a closing tag and if it's what closes the current element
                tags.push(content.substring(obj.index, sObj.index + sObj.tag.length)); // Push the innerHTML into the array 'tags'
                return true; // End the loop
            }
            (0, server_1.log)('findHtmlTags: Unexpected condition detected.');
        });
        nestCnt = 0; // Reset
    });
    if (!tagnames)
        return tags;
    // Sort out tags if the relevant parameter is passed to the function
    if (typeof tagnames === 'string')
        tagnames = [tagnames];
    const tagNameRegex = new RegExp(`^<(?:${tagnames.join('|')})[^\\S\\r\\n]*[^>]*>`); // Matches e.g. <div class="CLASS"> if tagnames === ['div']
    tags = tags.filter(item => item.match(tagNameRegex));
    return tags;
}
exports.findHtmlTags = findHtmlTags;
/** Get strings enclosed by \<!-- -->, \<nowiki />, \<pre />, \<syntaxhighlight />, and \<source />. */
function extractCommentOuts(wikitext) {
    return wikitext.match(/<!--[\s\S]*?-->|<nowiki>[\s\S]*?<\/nowiki>|<pre[\s\S]*?<\/pre>|<syntaxhighlight[\s\S]*?<\/syntaxhighlight>|<source[\s\S]*?<\/source>/gm) || [];
}
exports.extractCommentOuts = extractCommentOuts;
/** Get the parameters of templates as an array. The template's name is not included. */
function getTemplateParams(template) {
    // If the template doesn't contain '|', it doesn't have params
    if (!template.includes('|'))
        return [];
    // Remove the first '{{' and the last '}}' (or '|}}')
    template = template.replace(/^\{{2}|\|*\}{2}$/g, '');
    // In case the inner params nest other templates
    let nested = findTemplates(template);
    if (nested.length !== 0) {
        // Remove nested templates from the array
        nested = nested.filter(item => {
            return nested.filter(itemN => {
                return itemN !== item; // Filter out other elements of the array
            }).every(itemN => {
                return !itemN.includes(item); // Only return templates that are not included in others
            });
        });
        // Temporarily replace nested templates with '$TLn' because pipes in them can mess up the output
        nested.forEach((item, i) => {
            template = template.split(item).join(`$TL${i}`);
        });
    }
    // Get an array of parameters
    const params = template.split('|');
    params.shift(); // Remove the template name
    if (nested.length !== 0) {
        const regex = /\$TL(\d+)/g;
        params.forEach((item, i) => {
            let m;
            while (m = regex.exec(item)) {
                const index = parseInt(m[1]);
                params[i] = params[i].split(m[0]).join(nested[index]); // Get the repalced nested templates back
            }
        });
    }
    return params;
}
exports.getTemplateParams = getTemplateParams;
/** Extract all UserANs with open reports as an array. */
function getOpenUserANs(wikitext) {
    if (!wikitext) {
        (0, server_1.log)('getOpenUserANs: The wikitext passed as an argument is an empty string or undefined.');
        return [];
    }
    // Get all UserANs in the wikitext
    const templates = findTemplates(wikitext, 'UserAN');
    if (templates.length === 0)
        return [];
    // RegExps to evaluate the templates' parameters
    const paramsRegExp = {
        bot: /^\s*bot\s*=/,
        type: /^\s*(?:t|[Tt]ype)\s*=/,
        statusS: /^\s*(?:状態|s|[Ss]tatus)\s*=\s*$/,
        statusSClosed: /^\s*(?:状態|s|[Ss]tatus)\s*=\s*.+/, // Closed statusS
    };
    // Find UserANs with open reports by evaluating their parameters
    const UserAN = templates.filter(template => {
        // Get parameters
        let params = getTemplateParams(template);
        if (params.length === 0)
            return false;
        params = params.filter(item => !item.match(paramsRegExp.bot)); // Remove bot= parameter if there's any
        /**********************************************************************************************************\
            A full list of parameter combinations
                params.length === 1
                - [(1=)username] (open)
                params.length === 2
                - [t=TYPE, (1=)username] (open)
                - [(1=)username, 状態=] (open)
                - [(1=)username, 状態=X] (closed) => UserANs with a 状態=X paremeter are always closed
                - [(1=)username, (2=)無期限] (closed)
                params.length === 3
                - [t=TYPE, (1=)username, 状態=] (open)
                - [t=TYPE, (1=)username, 状態=X] (closed) => UserANs with a 状態=X paremeter are always closed
                - [t=TYPE, (1=)username, (2=)無期限] (closed)
                - [(1=)username, 状態=, (2=)無期限] (closed)
                params.length === 4
                - [t=TYPE, (1=)username, 状態=, (2=)無期限] (closed)
            Only UserANs with params in one of the four patterns need to be configured with obj.closed = false
        \***********************************************************************************************************/
        // 状態=X param is present: Always closed
        if (params.filter(item => item.match(paramsRegExp.statusSClosed)).length > 0)
            return false;
        // Change the 'closed' property of the object if the relevant UserAN is an open request
        let isOpen = false;
        const hasTypeParam = params.filter(item => item.match(paramsRegExp.type)).length > 0;
        const hasUnvaluedStatusSParam = params.filter(item => item.match(paramsRegExp.statusS)).length > 0;
        switch (params.length) {
            case 1: // [(1=)username] (open)
                isOpen = true;
                break;
            case 2: // [t=TYPE, (1=)username] (open), [(1=)username, 状態=] (open), [(1=)username, (2=)無期限] (closed)
                if (hasTypeParam || hasUnvaluedStatusSParam)
                    isOpen = true;
                break;
            case 3: // [t=TYPE, (1=)username, 状態=] (open), [t=TYPE, (1=)username, (2=)無期限] (closed), [(1=)username, 状態=, (2=)無期限] (closed)
                if (hasTypeParam && hasUnvaluedStatusSParam)
                    isOpen = true;
                break;
            default:
        }
        return isOpen;
    });
    return UserAN;
}
exports.getOpenUserANs = getOpenUserANs;
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
                        name: capitalizeFirstLetter(templateTextPipesBack.replace(/^\{\{/, '').split(/\||\}/)[0].trim()),
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
            let subtemplates = parsed
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
    let args = innerContent.split('|');
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
    return string.replace(/\x01/g, '|');
}
function parseHtml(html, config, nestlevel = 0) {
    // Initialize config
    config = Object.assign({
        recursive: true,
        namePredicate: null,
        htmlPredicate: null
    }, config || {});
    const openingTagRegex = /^(?:<!--|<([a-z]+) ?[^>]*?>)/i;
    const closingTagRegex = /^(?:-->|<\/([a-z]+) ?[^>]*?>)/i;
    let curTagName, tempTagName;
    let matched;
    let inTag = false;
    let numUnclosed = 0;
    let parsed = [];
    let startIdx, endIdx;
    for (let i = 0; i < html.length; i++) {
        const slicedHtml = html.slice(i);
        if (numUnclosed === 0) {
            if ((matched = slicedHtml.match(openingTagRegex))) {
                inTag = true;
                startIdx = i;
                curTagName = matched[1] ? matched[1].toLowerCase() : 'comment';
                numUnclosed++;
                i += matched[0].length - 1;
            }
        }
        else {
            if ((matched = slicedHtml.match(openingTagRegex))) {
                tempTagName = matched[1] ? matched[1].toLowerCase() : 'comment';
                if (tempTagName === curTagName)
                    numUnclosed++;
                i += matched[0].length - 1;
            }
            else if ((matched = slicedHtml.match(closingTagRegex))) {
                tempTagName = matched[1] ? matched[1].toLowerCase() : 'comment';
                if (tempTagName === curTagName && numUnclosed === 1) {
                    inTag = false;
                    endIdx = i + matched[0].length;
                    parsed.push({
                        text: html.slice(startIdx, endIdx),
                        name: curTagName,
                        nestlevel: nestlevel
                    });
                    curTagName = '';
                    numUnclosed--;
                }
                i += matched[0].length - 1;
            }
        }
    }
    if (config) {
        // Get nested tags?
        if (config.recursive) {
            let nestedTags = parsed
                .map((subhtml) => {
                // Get rid of the first '<' and the last '>' to make sure that another call of parseHtml() doesn't parse itself
                return subhtml.text.slice(1, -1);
            })
                .filter((subhtml) => {
                // Filter out tags that nest other tags
                return /<!--.*?(?=-->)|<([a-z]+) ?[^>]*?>.*?(?=<\/\1[^>]*?>)/si.test(subhtml);
            })
                .map((subhtml) => {
                return parseHtml(subhtml, config, nestlevel + 1);
            }) // Array of arrays of objects here
                .flat(); // Shrink the result to an array of objects
            parsed = parsed.concat(nestedTags);
        }
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
    const commentTags = parseHtml(wikitext, {
        namePredicate: (name) => ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source'].includes(name)
    })
        .filter((Html, i, arr) => {
        // Get rid of comment tags that are nested inside bigger comment tags
        const arrayExcludingCurrentItem = arr.slice(0, i).concat(arr.slice(i + 1));
        return arrayExcludingCurrentItem.every((obj) => !obj.text.includes(Html.text));
    })
        .map((Html) => Html.text);
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
function parseContentBySection(content) {
    const regex = {
        header: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/,
        headerG: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/g,
        headerEquals: /(?:^={2,5}[^\S\n\r]*|[^\S\n\r]*={2,5}$)/g
    };
    // Get headers and exclude those in comment tags
    const matched = content.match(regex.headerG);
    let headers = matched ? matched.slice() : [];
    extractCommentOuts(content).forEach(co => {
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
exports.parseContentBySection = parseContentBySection;
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
    var seconds = Math.floor(diff / 1000), minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24), weeks = Math.floor(days / 7), months = Math.floor(days / 30), years = Math.floor(days / 365);
    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    days %= 30;
    weeks %= 7;
    months %= 30;
    years %= 365;
    if (years) {
        return years + '年';
    }
    else if (months) {
        return months + 'か月';
    }
    else if (weeks) {
        return weeks + '週間';
    }
    else if (days) {
        return days + '日';
    }
    else if (hours) {
        return hours + '時間';
    }
    else if (minutes) {
        return minutes + '分';
    }
    else if (seconds) {
        return seconds + '秒';
    }
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
function isIPv4(ip) {
    return net_1.default.isIPv4(ip) || (0, is_cidr_1.v4)(ip);
}
exports.isIPv4 = isIPv4;
/** Check whether a given string is an IPv6 address. */
function isIPv6(ip) {
    return net_1.default.isIPv6(ip) || (0, is_cidr_1.v6)(ip);
}
exports.isIPv6 = isIPv6;
