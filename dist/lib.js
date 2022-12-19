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
exports.lib = void 0;
const net_1 = __importDefault(require("net"));
const is_cidr_1 = __importStar(require("is-cidr"));
const cheerio = __importStar(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
const server_1 = require("./server");
const mw_1 = require("./mw");
// ****************************** ASYNCHRONOUS FUNCTIONS ******************************
/**
 * @param {string} pagename
 * @returns {Promise<boolean|{isRedirect: boolean, basetimestamp: string, curtimestamp: string, content: string, revid: string}|undefined>}
 * False if page doesn't exit, undefined if error occurs, or else an object
 */
function getLatestRevision(pagename) {
    const mw = (0, mw_1.getMw)();
    return new Promise(resolve => {
        mw.request({
            action: 'query',
            titles: pagename,
            prop: 'info|revisions',
            rvprop: 'ids|timestamp|content',
            rvslots: 'main',
            curtimestamp: 1,
            formatversion: 2
        }).then(res => {
            var resPgs;
            if (!res || !res.query || !(resPgs = res.query.pages))
                return resolve();
            if (resPgs.length === 0)
                return resolve();
            resPgs = resPgs[0];
            if (resPgs.missing)
                return resolve(false);
            const resRev = resPgs.revisions[0];
            resolve({
                isRedirect: resPgs.redirect ? true : false,
                basetimestamp: resRev.timestamp,
                curtimestamp: res.curtimestamp,
                content: resRev.slots.main.content,
                revid: resRev.revid.toString()
            });
        }).catch(err => resolve((0, server_1.log)(err.info)));
    });
}
/**
 * Let the code sleep for n milliseconds
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
let lastedit;
/**
 * Edit a given page, ensuring a 5 second interval since the last edit. If the edit fails because of an expired token, another edit attempt is automatically made after re-login.
 * @param {*} params
 * @param {boolean} [autoInterval = true] True by default
 * @param {boolean} [retry] Automatically set to true for a second edit attempt after re-login. Don't specify this parameter manually.
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
    /** @type {boolean|undefined} True if edit succeeds, false if it fails because of an unknown error, undefined if it fails because of a known error. */
    const result = await mw.request(params)
        .then((res) => {
        apiReponse = res;
        return res && res.edit && res.edit.result === 'Success';
    })
        .catch((err) => {
        apiReponse = err;
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
            (0, server_1.log)(params.title + ': Edit failed: ' + apiReponse.info);
            if (!apiReponse.info.includes('Invalid CSRF token'))
                return apiReponse;
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
/**
 * Get an array of pagetitles that have links to a given page, transclusions not included
 * @param {string} pagetitle
 * @param {Array<number>} [nsExclude] an array of namespace numbers to exclude
 * @returns {Promise<Array<string>|undefined>}
 */
async function getBackLinks(pagetitle, nsExclude) {
    var pages = [];
    const mw = (0, mw_1.getMw)();
    if (typeof nsExclude === 'undefined')
        nsExclude = [];
    const query = blcontinue => {
        return new Promise(resolve => {
            mw.request({
                action: 'query',
                list: 'backlinks',
                bltitle: pagetitle,
                bllimit: 'max',
                blcontinue: blcontinue,
                formatversion: '2'
            }).then(async (res) => {
                var resBL, resCont;
                if (!res || !res.query || !(resBL = res.query.backlinks))
                    return resolve((0, server_1.log)('getBackLinks: Query failed.'));
                const titles = resBL.filter(obj => nsExclude.indexOf(obj.ns) === -1).map(obj => obj.title);
                pages = pages.concat(titles);
                if (res && res.continue && (resCont = res.continue.blcontinue)) {
                    await query(resCont);
                }
                resolve(true);
            }).catch(err => resolve((0, server_1.log)(err.info)));
        });
    };
    const result = await query();
    return result ? pages : undefined;
}
/**
 * Get an array of pagetitles that have links to a given page, transclusions not included
 * @param {string} cattitle Must start with 'Category:' but automatically added
 * @param {Array<number>} [nsExclude] an array of namespace numbers to exclude
 * @returns {Promise<Array<string>|undefined>}
 */
async function getCatMembers(cattitle, nsExclude) {
    if (cattitle && !cattitle.match(/^Category:/))
        cattitle = 'Category:' + cattitle;
    var cats = [];
    if (typeof nsExclude === 'undefined')
        nsExclude = [];
    const mw = (0, mw_1.getMw)();
    const query = cmcontinue => {
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
                var resCM, resCont;
                if (!res || !res.query || !(resCM = res.query.categorymembers))
                    return resolve((0, server_1.log)('getCatMembers: Query failed.'));
                const titles = resCM.filter(obj => nsExclude.indexOf(obj.ns) === -1).map(obj => obj.title);
                cats = cats.concat(titles);
                if (res && res.continue && (resCont = res.continue.cmcontinue)) {
                    await getCatMembers(cattitle, resCont);
                }
                resolve(true);
            }).catch(err => resolve((0, server_1.log)(err.info)));
        });
    };
    var result = await query();
    result = result ? cats : undefined;
    if (Array.isArray(result) && result.length === 0)
        (0, server_1.log)('No page belongs to ' + cattitle);
    return result;
}
/**
 * Get a list of pages that transclude a given page
 * @param {string} pagetitle
 * @returns {Promise<Array<string>>}
 */
async function getTranscludingPages(pagetitle) {
    var pages = [];
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
                var resEi, resCont;
                if (!res || !res.query || !(resEi = res.query.embeddedin))
                    return resolve();
                const titles = resEi.map(obj => obj.title);
                pages = pages.concat(titles);
                if (res && res.continue && (resCont = res.continue.eicontinue)) {
                    await query(resCont);
                }
                resolve();
            }).catch(err => resolve((0, server_1.log)(err.info)));
        });
    };
    await query();
    return pages;
}
/**
 * Filter protected pages out of a list of pagetitles
 * @param {Array<string>} pagetitles
 * @return {Promise<Array<string>>|null} Protected titles; null if any internal query failed
 */
async function filterOutProtectedPages(pagetitles) {
    const mw = (0, mw_1.getMw)();
    /**
     * @param {Array<string>} pagetitlesArr Subject to apihighlimit
     * @returns {Promise<Array<string>>} Protected titles
     */
    const query = function (pagetitlesArr) {
        return new Promise(resolve => {
            mw.request({
                action: 'query',
                titles: pagetitlesArr.join('|'),
                prop: 'info',
                inprop: 'protection',
                formatversion: '2'
            }).then(res => {
                var resPg;
                if (!res || !res.query || !(resPg = res.query.pages))
                    return resolve();
                const d = new Date();
                const isProtected = function (prtArr) {
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
                    var prtArr;
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
            }).catch(err => {
                (0, server_1.log)(err.info);
                resolve();
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
    const protectedPages = result.filter(el => el).flat().undup();
    return failed ? null : protectedPages;
}
/**
 * Scrape a webpage
 * @param {string} url
 * @returns {Promise<cheerio|undefined>}
 */
async function scrape(url) {
    try {
        const res = await axios_1.default.get(url);
        const $ = cheerio.load(res.data);
        return $;
    }
    catch (err) {
        return (0, server_1.log)(err);
    }
}
/**
 * Get a username from an account creation logid
 * @param {number|string} logid
 * @returns {Promise<string|undefined>}
 */
async function scrapeUsernameFromLogid(logid) {
    const url = 'https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AD%E3%82%B0&logid=' + logid;
    const $ = await scrape(url);
    if (!$)
        return;
    var $newusers = $('.mw-logline-newusers');
    if ($newusers.length === 0)
        return;
    $newusers = $newusers.eq(0);
    var username;
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
// ****************************** SYNCHRONOUS FUNCTIONS ******************************
/**
 * Extract templates from wikitext
 * @param {string} wikitext the wikitext from which templates are extracted
 * @param {string|Array<string>} [templateName] sort out templates by these template names
 * @param {string|Array<string>} [templatePrefix] sort out templates by these template prefixes
 * @returns {Array<string>}
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
    var templates = tempInnerContents.reduce((acc, tempInnerContent, i, arr) => {
        if (i === 0)
            return acc;
        var temp;
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
     * Function to create a regex that makes the first character of a template case-insensitive
     * @param {string} str
     * @returns {string} [Xx]
     */
    const caseInsensitiveFirstLetter = str => '[' + str.substring(0, 1).toUpperCase() + str.substring(0, 1).toLowerCase() + ']';
    // Create regex for template sorting
    const names = [], prefixes = [];
    if (templateName) {
        for (let i = 0; i < templateName.length; i++) {
            names.push(caseInsensitiveFirstLetter(templateName[i]) + escapeRegExp(templateName[i].substring(1)));
        }
        var templateNameRegExp = new RegExp('^(' + names.join('|') + ')$');
    }
    if (templatePrefix) {
        for (let i = 0; i < templatePrefix.length; i++) {
            prefixes.push(caseInsensitiveFirstLetter(templatePrefix[i]) + escapeRegExp(templatePrefix[i].substring(1)));
        }
        var templatePrefixRegExp = new RegExp('^(' + prefixes.join('|') + ')');
    }
    // Sort out certain templates
    var errHandler = false;
    templates = templates.filter(item => {
        var name = item.match(/^\{{2}\s*([^|{}\n]+)/);
        if (!name) {
            errHandler = true;
            return false;
        }
        name = name[1].trim(); // {{ TEMPLATENAME | ... }} の TEMPLATENAME を抽出
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
/**
 * Find all HTML tags in a string, including innerHTML
 * @param {string} content String in which to search for tags
 * @param {string|Array<string>} [tagnames] Tags to sort out
 * @returns {Array<string>} Array of outerHTMLs
 */
function findHtmlTags(content, tagnames) {
    // Remove comments
    extractCommentOuts(content).forEach(co => {
        const regex = new RegExp(escapeRegExp(co) + '\\s?');
        content = content.replace(regex, '');
    });
    // Get all <tag> and </tag>s and create an array of objects
    const regex = /(?:<[^\s/>]+[^\S\r\n]*[^>]*>|<\/[^\S\r\n]*[^\s>]+[^\S\r\n]*>)/g;
    // const regex = /(?:<([^\s/>]+)[^\S\r\n]*[^>]*>|<\/[^\S\r\n]*([^\s>]+)[^\S\r\n]*>)/g;
    const mArr = [];
    var m;
    while ((m = regex.exec(content))) {
        const type = m[0].match(/^<[^\S\r\n]*\//) ? 'end' : 'start';
        mArr.push({
            tag: m[0],
            tagname: m[0].match(/^<\/?[^\S\r\n]*([^\s>]+)[^\S\r\n]*[^>]*>$/)[1],
            // tagname: m[1], // The capturing group doesn't work for closing tags for some reason
            type: type,
            index: m.index // Index of the tag in the content
        });
    }
    var nestCnt = 0, tags = [];
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
/**
 * Get strings enclosed by \<!-- -->, \<nowiki />, \<pre />, \<syntaxhighlight />, and \<source />
 * @param {string} wikitext
 * @returns {Array<string>}
 */
function extractCommentOuts(wikitext) {
    return wikitext.match(/<!--[\s\S]*?-->|<nowiki>[\s\S]*?<\/nowiki>|<pre[\s\S]*?<\/pre>|<syntaxhighlight[\s\S]*?<\/syntaxhighlight>|<source[\s\S]*?<\/source>/gm) || [];
}
/**
 * Get the parameters of templates as an array
 * @param {string} template
 * @returns {Array<string>} This doesn't contain the template's name
 */
function getTemplateParams(template) {
    // If the template doesn't contain '|', it doesn't have params
    if (!template.includes('|'))
        return [];
    // Remove the first '{{' and the last '}}' (or '|}}')
    var params = template.replace(/^\{{2}|\|*\}{2}$/g, '');
    // In case the params nest other templates
    var nested = findTemplates(params);
    if (nested.length !== 0) {
        nested = nested.filter(item => {
            return nested.filter(itemN => itemN !== item).every(itemN => !itemN.includes(item)); // ↳ in {{TL1| {{TL2}} }} ), but we don't need TL2
            // ↳ Look at the other elements in the array 'nested' (.filter) and only preserve items that are not part of those items (.every)
        });
        nested.forEach((item, i) => {
            params = params.split(item).join(`$TL${i}`); // Replace nested templates with '$TLn'
        });
    }
    // Get an array of parameters
    params = params.split('|'); // This could be messed up if the nested templates hadn't been replaced
    params.shift(); // Remove the template name
    if (nested.length !== 0) {
        params.forEach((item, i) => {
            var m;
            if ((m = item.match(/\$TL\d+/g))) { // Find all $TLn in the item
                for (let j = 0; j < m.length; j += 2) {
                    const index = m[j].match(/\$TL(\d+)/)[1];
                    m.splice(j + 1, 0, index); // Push the index at m[j + 1]
                    const replacee = j === 0 ? item : params[i];
                    params[i] = replacee.split(m[j]).join(nested[m[j + 1]]); // Re-replace delimiters with original templates
                }
            }
        });
    }
    return params;
}
/**
 * Extract all UserANs with open reports as an array
 * @param {string} wikitext
 * @returns {Array<string>}
 */
function getOpenUserANs(wikitext) {
    if (!wikitext) {
        (0, server_1.log)('lib.getOpenUserANs: The wikitext passed as an argument is an empty string or undefined.');
        return [];
    }
    // Get all UserANs in the wikitext
    const templates = findTemplates(wikitext, 'UserAN');
    if (templates.length === 0)
        return [];
    // Create an array of objects out of the 'templates' array
    var UserAN = templates.map(tmpl => {
        return {
            template: tmpl,
            closed: true
        };
    });
    // RegExps to evaluate the templates' parameters
    const paramsRegExp = {
        bot: /^\s*bot\s*=/,
        type: /^\s*(?:t|[Tt]ype)\s*=/,
        statusS: /^\s*(?:状態|s|[Ss]tatus)\s*=\s*$/,
        statusSClosed: /^\s*(?:状態|s|[Ss]tatus)\s*=\s*.+/, // Closed statusS
    };
    // Find UserANs with open reports by evaluating their parameters
    UserAN.forEach(obj => {
        // Get parameters
        var params = getTemplateParams(obj.template); // This doesn't include the template name
        if (params.length === 0)
            return;
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
        if (params.filter(item => item.match(paramsRegExp.statusSClosed)).length > 0)
            return; // 状態=X param is present: Always closed
        switch (params.length) {
            case 1: // [(1=)username] (open)
                obj.closed = false;
                return;
            case 2: // [t=TYPE, (1=)username] (open), [(1=)username, 状態=] (open), [(1=)username, (2=)無期限] (closed)
                if (params.filter(item => item.match(paramsRegExp.type)).length > 0 || // The template has a type param, or
                    params.filter(item => item.match(paramsRegExp.statusS)).length > 0) { // the template has a 状態= param: The request is open
                    obj.closed = false;
                }
                return;
            case 3: // [t=TYPE, (1=)username, 状態=] (open), [t=TYPE, (1=)username, (2=)無期限] (closed), [(1=)username, 状態=, (2=)無期限] (closed)
                if (params.some(item => item.match(paramsRegExp.type)) && params.some(item => item.match(paramsRegExp.statusS)))
                    obj.closed = false;
        }
    });
    return UserAN.filter(obj => !obj.closed).map(obj => obj.template);
}
/**
 * @param {string} content
 * @returns {Array<{header: string, title: string, level: number, index: number, content: string, deepest: boolean}>} Never undefined
 */
function parseContentBySection(content) {
    const regex = {
        header: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/,
        headerG: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/g,
        headerEquals: /(?:^={2,5}[^\S\n\r]*|[^\S\n\r]*={2,5}$)/g
    };
    var headers = content.match(regex.headerG);
    extractCommentOuts(content).forEach(co => {
        headers = headers.filter(header => !co.includes(header));
    });
    const sections = [];
    sections.push({
        header: null,
        title: null,
        level: 1,
        index: 0,
        content: headers ? content.split(headers[0])[0] : content,
        deepest: null
    });
    if (headers) {
        headers.forEach(header => {
            sections.push({
                header: header,
                title: header.replace(regex.headerEquals, ''),
                level: header.match(/=/g).length / 2,
                index: undefined,
                content: undefined,
                deepest: undefined
            });
        });
        sections.forEach((obj, i, arr) => {
            if (i === 0)
                return;
            var sectionContent;
            arr.slice(i + 1).some(obj2 => {
                if (obj2.level <= obj.level)
                    sectionContent = content.substring(content.indexOf(obj.header), content.indexOf(obj2.header));
                return typeof sectionContent !== 'undefined';
            });
            if (!sectionContent)
                sectionContent = content.substring(content.indexOf(obj.header)); // For last section
            obj.index = i;
            obj.content = sectionContent;
            obj.deepest = obj.content.match(regex.header).length === 1;
        });
    }
    return sections;
}
/**
 * @param {string} timestamp1
 * @param {string} timestamp2
 * @param {boolean} [rewind5minutes] if true, rewind timestamp1 by 5 minutes
 * @returns {number} timestamp2 - timestamp1 (in milliseconds)
 */
function compareTimestamps(timestamp1, timestamp2, rewind5minutes) {
    if (typeof timestamp1 === 'undefined' || typeof timestamp2 === 'undefined')
        return;
    const ts1 = new Date(timestamp1);
    if (rewind5minutes)
        ts1.setMinutes(ts1.getMinutes() - 5);
    const ts2 = new Date(timestamp2);
    const diff = ts2.getTime() - ts1.getTime();
    return diff;
}
/**
 * @param {string} timestamp1
 * @param {string} timestamp2
 * @returns {string|undefined}
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
/**
 * Escapes \ { } ( ) . ? * + - ^ $ [ ] | (but not '!')
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
    return str.replace(/[\\{}().?*+\-^$[\]|]/g, '\\$&');
}
/**
 * Get the last day of a given month
 * @param {number|string} year
 * @param {number|string} month 1-12
 * @returns {number}
 */
function lastDay(year, month) {
    return new Date(year, month, 0).getDate();
}
/**
 * Get the Japanese name of a day of the week from JSON timestamp
 * @param {string} timestamp
 * @returns {string}
 */
function getWeekDayJa(timestamp) {
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    return daysOfWeek[new Date(timestamp).getDay()];
}
/**
 * Check if a string is an IP address
 * @param {string} ip
 * @returns {boolean}
 */
function isIPAddress(ip) {
    return net_1.default.isIP(ip) || (0, is_cidr_1.default)(ip);
}
/**
 * Check if a string is an IPv4 address
 * @param {string} ip
 * @returns {boolean}
 */
function isIPv4(ip) {
    return net_1.default.isIPv4(ip) || (0, is_cidr_1.v4)(ip);
}
/**
 * Check if a string is an IPv6 address
 * @param {string} ip
 * @returns {boolean}
 */
function isIPv6(ip) {
    return net_1.default.isIPv6(ip) || (0, is_cidr_1.v6)(ip);
}
exports.lib = {
    getLatestRevision,
    sleep,
    edit,
    getBackLinks,
    getCatMembers,
    getTranscludingPages,
    filterOutProtectedPages,
    scrape,
    scrapeUsernameFromLogid,
    findTemplates,
    findHtmlTags,
    extractCommentOuts,
    getTemplateParams,
    getOpenUserANs,
    parseContentBySection,
    compareTimestamps,
    getDuration,
    escapeRegExp,
    lastDay,
    getWeekDayJa,
    isIPAddress,
    isIPv4,
    isIPv6
};
