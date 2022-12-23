import net from 'net';
import isCidr, { v4, v6 } from 'is-cidr';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { log } from './server';
import { getMw, init, isBot } from './mw';
import { ApiResponse, ApiResponseError, ApiResponseEdit, ApiResponseQueryPagesProtection } from './index';
import { ApiEditPageParams } from 'types-mediawiki/api_params';


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
 * @param arams 
 * @param autoInterval True by default
 * @param retry Automatically set to true for a second edit attempt after re-login. Don't specify this parameter manually.
 * @returns apiReponse (null if a second edit attempt fails or if the mwbot instance fails to be initialized)
 */
export async function edit(params: ApiEditPageParams, autoInterval = true, retry?: boolean): Promise<ApiResponse|ApiResponseError|null> {

    // Initialize the request parameters
    let mw = getMw();
    params = Object.assign(params, {
        action: 'edit',
        token: mw.editToken,
        curtimestamp: true,
        formatversion: '2'
    });

    // Make sure that it's been more than 5 seconds since the last edit
    if (lastedit && autoInterval) {
        const diff = compareTimestamps(lastedit, new Date().toJSON());
        if (diff < 4400) await sleep(4400 - diff);
    }

    // Edit the page
    log(`Editing ${params.title}...`);
    interface MergedApiResponse extends ApiResponse {
        
    }
    let apiReponse: ApiResponse;
    let apiReponseErr: ApiResponseError;
    /** True if edit succeeds, false if it fails because of an unknown error, undefined if it fails because of a known error. */
    const result: boolean|undefined = await mw.request(params)
    .then((res: ApiResponse) => {
        apiReponse = res;
        return res && res.edit && res.edit.result === 'Success';
    })
    .catch((err: ApiResponseError) => {
        apiReponseErr = err;
        return;
    });
    switch (result) {
        case true:
            log(params.title + ': Edit done.');
            lastedit = new Date().toJSON();
            return apiReponse!;
        case false:
            log(params.title + ': Edit failed due to an unknown error.');
            return apiReponse!;
        default:
            log(params.title + ': Edit failed: ' + apiReponseErr!.info);
            if (!apiReponseErr!.info.includes('Invalid CSRF token')) return apiReponseErr!;
    }

    // Error handler for an expired token
    if (retry) return null;
    log('Edit token seems to have expired. Relogging in...');
    mw = await init();
    if (!mw) return null;
    params = Object.assign(params, {token: mw.editToken});
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

                const titles = resBL.filter(obj => !nsExclude!.includes(obj.ns)).map(obj => obj.title);
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
 * @param cattitle Must start with 'Category:' but automatically added
 * @param nsExclude An array of namespace numbers to exclude
 * @returns
 */
export async function getCatMembers(cattitle: string, nsExclude?: number[]): Promise<string[]|undefined> {

    if (cattitle && !cattitle.match(/^Category:/)) cattitle = 'Category:' + cattitle;

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

                const titles = resCM.filter(obj => !nsExclude!.includes(obj.ns)).map(obj => obj.title);
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

/** Get a list of pages that transclude a given page. */
export async function getTranscludingPages(pagetitle: string): Promise<string[]> {

    let pages: string[] = [];
    const mw = getMw();
    const query = function(eicontinue?: string) {
        return new Promise<void>(resolve => {
            mw.request({
                action: 'query',
                list: 'embeddedin',
                eititle: pagetitle,
                eifilterredir: 'nonredirects',
                eilimit: 'max',
                eicontinue: eicontinue,
                formatversion: '2'
            }).then(async (res: ApiResponse) => {

                let resEi, resCont;
                if (!res || !res.query || !(resEi = res.query.embeddedin)) return resolve();

                const titles = resEi.map(obj => obj.title);
                pages = pages.concat(titles);

                if (res && res.continue && (resCont = res.continue.eicontinue)) {
                    await query(resCont);
                }
                resolve();

            }).catch((err: ApiResponseError) => resolve(log(err.info)));
        });
    };

    await query();
    return pages;

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

                const titles = resPg.filter(obj => {
                    let prtArr;
                    if (!obj.title) return false;
                    if (!(prtArr = obj.protection) || prtArr.length === 0) {
                        return false;
                    } else {
                        return isProtected(prtArr);
                    }
                }).map(obj => obj.title);

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
    const protectedPages = result.flat().filter((el): el is string => typeof el === 'string').undup();

    return failed ? undefined : protectedPages;

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

/** Get a username from an account creation logid. */
export async function scrapeUsernameFromLogid(logid: string|number): Promise<string|undefined> {

    const url = 'https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AD%E3%82%B0&logid=' + logid;
    const $ = await scrapeWebpage(url);
    if (!$) return;

    let $newusers = $('.mw-logline-newusers');
    if ($newusers.length === 0) return;
    $newusers = $newusers.eq(0);

    let username;
    switch($newusers.attr('data-mw-logaction')) {
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
 * Extract templates from wikitext.
 * @param wikitext
 * @param templateName Filter out templates by these names.
 * @param templatePrefix Filter out templates by these name prefixes.
 * @returns
 */
export function findTemplates(wikitext: string, templateName? : string|string[], templatePrefix? : string|string[]): string[] {

    // Remove comments
    extractCommentOuts(wikitext).forEach(co => {
        const regex = new RegExp(escapeRegExp(co) + '\\s?');
        wikitext = wikitext.replace(regex, '');
    });

    // Create an array by splitting the original content with '{{'
    const tempInnerContents = wikitext.split('{{'); // Note: tempInnerContents[0] is always an empty string or a string that has nothing to do with templates
    if (tempInnerContents.length === 0) return [];

    // Extract templates from the wikitext
    const nest: number[] = [];
    let templates = tempInnerContents.reduce((acc: string[], tempInnerContent, i, arr) => { // Loop through all elements in tempInnerContents (except tempInnerContents[0])

        if (i === 0) return acc;

        let temp: string;
        const tempTailCnt = (tempInnerContent.match(/\}\}/g) || []).length; // The number of '}}' in the split array

        // There's no '}}' (= nesting other templates)
        if (tempTailCnt === 0) {

            nest.push(i); // Save the index of the element in the array

        // There's one '}}' in the element of the array (= the left part of '}}' is the whole of the template's parameters)
        } else if (tempTailCnt === 1) {

            temp = '{{' + tempInnerContent.split('}}')[0] + '}}';
            if (!acc.includes(temp)) acc.push(temp);

        // There're two or more '}}'s (e.g. 'TL2|...}}...}}'; = templates are nested)
        } else {

            for (let j = 0; j < tempTailCnt; j++) {

                if (j === 0) { // The innermost template

                    temp = '{{' + tempInnerContent.split('}}')[j] + '}}'; // Same as when there's one '}}' in the element
                    if (!acc.includes(temp)) acc.push(temp);

                } else { // Multi-nested template(s)

                    const elNum = nest[nest.length -1]; // The index of the element that involves the start of the nest
                    nest.pop(); // The index won't be reused after reference
                    const nestedTempInnerContent = tempInnerContent.split('}}'); // Create another array by splitting with '}}'

                    temp = '{{' + arr.slice(elNum, i).join('{{') + '{{' + nestedTempInnerContent.slice(0, j + 1).join('}}') + '}}';
                    if (!acc.includes(temp)) acc.push(temp);

                }

            }

        }
        return acc;

    }, []); // All templates in the wikitext is stored in 'templates' when the loop is done

    // End here if the templates don't need to be sorted
    if ((!templateName && !templatePrefix) || templates.length === 0) return templates;

    // Convert passed parameters to arrays if they are strings
    if (templateName && typeof templateName === 'string') templateName = [templateName];
    if (templatePrefix && typeof templatePrefix === 'string') templatePrefix = [templatePrefix];

    /**
     * Create a regex string that makes a certain character case-insensitive.
     * @param str
     * @returns [Xx]
     */
    const getCaseInsensitiveCharacterRegex = (str: string) => '[' + str.substring(0, 1).toUpperCase() + str.substring(0, 1).toLowerCase() + ']';

    // Create regex for template sorting
    const names = [], prefixes = [];
    let templateNameRegExp: RegExp;
    let templatePrefixRegExp: RegExp;
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
        } else if (templateName) {
            return name.match(templateNameRegExp);
        } else if (templatePrefix) {
            return name.match(templatePrefixRegExp);
        }
    });

    if (errHandler) log('findTemplates: Detected unprocessable braces.');
    return templates;

}

/**
 * Find all HTML tags in a string, including innerHTML.
 * @param content String in which to search for tags
 * @param tagnames Tags to return
 * @returns Array of outerHTMLs
 */
export function findHtmlTags(content: string, tagnames?: string|string[]): string[] {

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
            tag: m[0], // e.g. <div>, </div>
            tagname: m[0].match(/^<\/?[^\S\r\n]*([^\s>]+)[^\S\r\n]*[^>]*>$/)![1], // e.g. div
            type: type, // 'start' or 'end'
            index: m.index // Index of the tag in the content
        });
    }

    let nestCnt = 0;
    let tags: string[] = [];
    mArr.forEach((obj, i, arr) => {
        if (obj.type === 'end') return; // Loop through all opening tags
        if (!arr[i + 1]) return;
        arr.filter((fObj, fi) => i < fi && fObj.tagname === obj.tagname).some(sObj => { // Look at all elements after the current element of the array
            if (sObj.type === obj.type) { // If there's a starting tag, that's a nested tag (e.g. <div2> in <div> ... <div2> ... </div>)
                nestCnt++;
                return false; // Continue the loop
            } else if (sObj.type !== obj.type && nestCnt !== 0) { // If there's a closing tag and if it's for a nested opening tag
                nestCnt--;
                return false; // Continue the loop
            } else if (sObj.type !== obj.type && nestCnt === 0) { // If there's a closing tag and if it's what closes the current element
                tags.push(content.substring(obj.index, sObj.index + sObj.tag.length)); // Push the innerHTML into the array 'tags'
                return true; // End the loop
            }
            log('findHtmlTags: Unexpected condition detected.');
        });
        nestCnt = 0; // Reset
    });

    if (!tagnames) return tags;

    // Sort out tags if the relevant parameter is passed to the function
    if (typeof tagnames === 'string') tagnames = [tagnames];
    const tagNameRegex = new RegExp(`^<(?:${tagnames.join('|')})[^\\S\\r\\n]*[^>]*>`); // Matches e.g. <div class="CLASS"> if tagnames === ['div']
    tags = tags.filter(item => item.match(tagNameRegex));
    return tags;

}

/** Get strings enclosed by \<!-- -->, \<nowiki />, \<pre />, \<syntaxhighlight />, and \<source />. */
export function extractCommentOuts(wikitext: string): string[] {
    return wikitext.match(/<!--[\s\S]*?-->|<nowiki>[\s\S]*?<\/nowiki>|<pre[\s\S]*?<\/pre>|<syntaxhighlight[\s\S]*?<\/syntaxhighlight>|<source[\s\S]*?<\/source>/gm) || [];
}

/** Get the parameters of templates as an array. The template's name is not included. */
export function getTemplateParams(template: string): string[] {

    // If the template doesn't contain '|', it doesn't have params
    if (!template.includes('|')) return [];

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

/** Extract all UserANs with open reports as an array. */
export function getOpenUserANs(wikitext: string): string[] {

    if (!wikitext) {
        log('getOpenUserANs: The wikitext passed as an argument is an empty string or undefined.');
        return [];
    }

    // Get all UserANs in the wikitext
    const templates = findTemplates(wikitext, 'UserAN');
    if (templates.length === 0) return [];

    // RegExps to evaluate the templates' parameters
    const paramsRegExp = {
        bot: /^\s*bot\s*=/, // bot=
        type: /^\s*(?:t|[Tt]ype)\s*=/, // t=, type=, or Type=
        statusS: /^\s*(?:状態|s|[Ss]tatus)\s*=\s*$/, // 状態=, s=, status=, or Status=
        statusSClosed: /^\s*(?:状態|s|[Ss]tatus)\s*=\s*.+/, // Closed statusS
    };

    // Find UserANs with open reports by evaluating their parameters
    const UserAN = templates.filter(template => {

        // Get parameters
        let params = getTemplateParams(template);
        if (params.length === 0) return false;
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
        if (params.filter(item => item.match(paramsRegExp.statusSClosed)).length > 0) return false;

        // Change the 'closed' property of the object if the relevant UserAN is an open request
        let isOpen = false;
        const hasTypeParam = params.filter(item => item.match(paramsRegExp.type)).length > 0;
        const hasUnvaluedStatusSParam = params.filter(item => item.match(paramsRegExp.statusS)).length > 0;
        switch (params.length) {
            case 1: // [(1=)username] (open)
                isOpen = true;
                break;
            case 2: // [t=TYPE, (1=)username] (open), [(1=)username, 状態=] (open), [(1=)username, (2=)無期限] (closed)
                if (hasTypeParam || hasUnvaluedStatusSParam) isOpen = true;
                break;
            case 3: // [t=TYPE, (1=)username, 状態=] (open), [t=TYPE, (1=)username, (2=)無期限] (closed), [(1=)username, 状態=, (2=)無期限] (closed)
                if (hasTypeParam && hasUnvaluedStatusSParam) isOpen = true;
                break;
            default:
        }

        return isOpen;

    });

    return UserAN;

}

// interfaces for parseTemplates()
interface Template {
    /** The whole text of the template, starting with '{{' and ending with '}}'. */
    text: string;
    /** Name of the template. The first letter is always in upper case. */
    name: string;
    /** Parsed template arguments as an array. */
    arguments: TemplateArgument[];
    /** Nest level of the template. If it's not part of another template, the value is 0. */
    nestlevel: number;
}
interface TemplateArgument {
    text: string;
    name: string;
    value: string;
}
interface TemplateConfig {
	/** Also parse templates within subtemplates. True by default. */
	recursive?: boolean;
	/** Include template in result only if its name matches this predicate. (Should not be specified together with templatePredicate.)  */
	namePredicate?: (name: string) => boolean;
	/** Include template in result only if it matches this predicate. (Should not be specified together with namePredicate.) */
	templatePredicate?: (template: Template) => boolean;
}

/**
 * Parse templates in wikitext. Templates within tags that prevent transclusions (i.e. \<!-- -->, nowiki, pre, syntaxhighlist, source) are not parsed.
 * @param wikitext 
 * @param config
 * @param nestlevel Used module-internally. Don't specify this parameter manually.
 * @returns
 * @license siddharthvp@github - This function includes modifications from the original.
 * @link https://github.com/siddharthvp/mwn/blob/ccc6fb8/src/wikitext.ts#L77
 */
export function parseTemplates(wikitext: string, config?: TemplateConfig, nestlevel: number = 0): Template[] {

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
                    parsed.push({
                        text: templateTextPipesBack,
                        name: capitalizeFirstLetter(templateTextPipesBack.replace(/^\{\{/, '').split(/\||\}/)[0].trim()),
                        arguments: parseTemplateArguments(templateText),
                        nestlevel: nestlevel
                    });
				}
				numUnclosed -= 2;
				i++;
            } else if (wikitext[i] === '|' && numUnclosed > 2) { // numUnclosed > 2 means we're in a nested template
				// Swap out pipes with \x01 character.
				wikitext = strReplaceAt(wikitext, i, '\x01');
			} else if ((matchedTag = slicedWkt.match(/^(?:<!--|<(nowiki|pre|syntaxhighlist|source) ?[^>]*?>)/))) {
				inTag = true;
                tagNames.push(matchedTag[1] ? matchedTag[1] : 'comment');
				i += matchedTag[0].length - 1;
			}
        } else {
            // we are in a {{{parameter}}} or tag 
			if (wikitext[i] === '|' && numUnclosed > 2) {
				wikitext = strReplaceAt(wikitext, i, '\x01');
			} else if ((matchedTag = slicedWkt.match(/^(?:-->|<\/(nowiki|pre|syntaxhighlist|source) ?[^>]*?>)/))) {
				inTag = false;
                tagNames.pop();
				i += matchedTag[0].length - 1;
			} else if (/^\}\}\}/.test(slicedWkt)) {
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
            parsed = parsed.filter(({name}) => config!.namePredicate!(name));
        }
        // Filter the array by a user-defined condition?
        if (config.templatePredicate) {
            parsed = parsed.filter((Template) => config!.templatePredicate!(Template));
        }
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

    let args = innerContent.split('|');
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

function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function strReplaceAt(string: string, index: number, char: string): string {
	return string.slice(0, index) + char + string.slice(index + 1);
}

function replacePipesBack(string: string) {
    return string.replace(/\x01/g, '|');
}

// interfaces for parseHtml()
interface Html {
    /** OuterHTML of the tag. */
    text: string;
    /** Name of the tag in lower case. */
    name: string;
    /** Nest level of the tag. If it's not part of another tag, the value is 0. */
    nestlevel: number;
}
interface HtmlConfig {
	/** Also parse tags within tags. True by default. */
	recursive?: boolean;
	/**
     * Include tag in result only if its name matches this predicate, where \<!-- --> tags are named as 'comment'.
     * (Should not be specified together with htmlPredicate.)
     */
	namePredicate?: (name: string) => boolean;
	/** Include tag in result only if it matches this predicate. (Should not be specified together with namePredicate.) */
	htmlPredicate?: (Html: Html) => boolean;
}

export function parseHtml(html: string, config?: HtmlConfig, nestlevel = 0): Html[] {

    // Initialize config
    config = Object.assign({
        recursive: true,
        namePredicate: null,
        htmlPredicate: null
    }, config || {});


    const openingTagRegex = /^(?:<!--|<([a-z]+) ?[^>]*?>)/i;
    const closingTagRegex = /^(?:-->|<\/([a-z]+) ?[^>]*?>)/i;
    let curTagName: string, tempTagName: string;
    let matched;
    let inTag = false;
    let numUnclosed = 0;

    let parsed: Html[] = [];
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
        } else {
            if ((matched = slicedHtml.match(openingTagRegex))) {
                tempTagName = matched[1] ? matched[1].toLowerCase() : 'comment';
                if (tempTagName === curTagName!) numUnclosed++;
                i += matched[0].length - 1;
            } else if ((matched = slicedHtml.match(closingTagRegex))) {
                tempTagName = matched[1] ? matched[1].toLowerCase() : 'comment';
                if (tempTagName === curTagName! && numUnclosed === 1) {
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
 * Replace strings by given strings in a wikitext, ignoring replacees in tags that prevent transclusions (i.e. \<!-- -->, nowiki, pre, syntaxhighlist, source).
 * The replacees array and the replacers array must have the same number of elements in them.
 */
export function replaceWikitext(wikitext: string, replacees: string[], replacers: string[]): string {

    if (replacees.length !== replacers.length) throw 'replaceWikitext: replacees and replacers must have the same number of elements in them.';

    // Extract transclusion-preventing tags in the wikitext
    const commentTags =
        parseHtml(wikitext, {
            namePredicate: (name) => ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source'].includes(name)
        })
        .filter((Html, i, arr) => {
            // Get rid of comment tags that are nested inside bigger comment tags
            const arrayExcludingCurrentItem = arr.slice(0, i).concat(arr.slice(i + 1));
            return arrayExcludingCurrentItem.every((obj: Html) => !obj.text.includes(Html.text));
        })
        .map((Html) => Html.text);

    // Temporarily replace comment tags with a (unique) control character
    commentTags.forEach((tag, i) => {
        wikitext = wikitext.replace(tag, `$CO${i}`);
    });

    // Replace all
    for (let i = 0; i < replacees.length; i++) {
        wikitext = wikitext.split(replacees[i]).join(replacers[i]);
    }

    // Get the comment tags back
    commentTags.forEach((tag, i) => {
        wikitext = wikitext.replace(`$CO${i}`, tag);
    });

    return wikitext;

}

/** Parse the content of a page into that of each section. */
export function parseContentBySection(content: string): Array<{
    header: string|null,
    title: string|null,
    level: number,
    index: number,
    content: string,
    deepest: boolean|null
}> {

    const regex = {
        header: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/,
        headerG: /={2,5}[^\S\n\r]*.+[^\S\n\r]*={2,5}?/g,
        headerEquals: /(?:^={2,5}[^\S\n\r]*|[^\S\n\r]*={2,5}$)/g
    };

    // Get headers and exclude those in comment tags
    const matched = content.match(regex.headerG);
    let headers = matched ? matched.slice() : [];
    extractCommentOuts(content).forEach(co => {
        headers = headers!.filter(header => !co.includes(header));
    });
    headers.unshift(''); // For the top section

    // Create an array of objects
    const sections = headers.map((header, i, arr) => {
        const isTopSection = i === 0;
        return {
            header: isTopSection ? null : header,
            title: isTopSection ? null : header.replace(regex.headerEquals, ''),
            level: isTopSection ? 1 : header.match(/=/g)!.length / 2,
            index: i,
            content: isTopSection ? (arr.length > 1 ? content.split(headers[1])[0] : content) : '',
            deepest: isTopSection ? null : false
        };
    });

    // Get the content property
    sections.forEach((obj, i, arr) => {

        // For top section
        if (!obj.header) return;

        // Check if there's any section of the same level or shallower following this section
        const nextBoundarySection = arr.slice(i + 1).find(objF => objF.level <= obj.level);

        // Get the content of this section
        let sectionContent: string;
        if (nextBoundarySection) {
            sectionContent = content.substring(content.indexOf(obj.header), content.indexOf(nextBoundarySection.header!));
        } else {
            sectionContent = content.substring(content.indexOf(obj.header));
        }

        obj.content = sectionContent;
        obj.deepest = typeof arr.slice(i + 1).find(objF => sectionContent.includes(objF.header!)) === 'undefined';

    });

    return sections;

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

/** 
 * Subtract timestamp2 by timestamp1 and output the resultant duration in Japanese.
 * If the time difference is a negative value, undefined is returned.
 */
export function getDuration(timestamp1: string, timestamp2: string) {

    const ts1 = new Date(timestamp1);
    const ts2 = new Date(timestamp2);
    const diff = ts2.getTime() - ts1.getTime();
    if (diff < 0) return;

    var seconds = Math.floor(diff / 1000),
        minutes = Math.floor(seconds / 60),
        hours = Math.floor(minutes / 60),
        days = Math.floor(hours / 24),
        weeks = Math.floor(days / 7),
        months = Math.floor(days / 30),
        years = Math.floor(days / 365);

    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    days %= 30;
    weeks %= 7;
    months %= 30;
    years %= 365;

    if (years) {
        return years + '年';
    } else if (months) {
        return months + 'か月';
    } else if (weeks) {
        return weeks + '週間';
    } else if (days) {
        return days + '日';
    } else if (hours) {
        return hours + '時間';
    } else if (minutes) {
        return minutes + '分';
    } else if (seconds) {
        return seconds + '秒';
    }

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
export function isIPv4(ip: string) {
    return net.isIPv4(ip) || v4(ip);
}

/** Check whether a given string is an IPv6 address. */
export function isIPv6(ip: string) {
    return net.isIPv6(ip) || v6(ip);
}