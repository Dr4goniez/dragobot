const my = require('./my');
const MWBot = require('mwbot');
const api = new MWBot({
    apiUrl: my.apiUrl
});
module.exports.api = api;
const net = require('net');
const isCidr = require('is-cidr');


// ****************************** ASYNCHRONOUS FUNCTIONS ******************************

/**
 * Log in and get an edit token
 * @param {boolean} [experiment] If true, get a token for the test account
 * @returns {Promise<string>} token
 */
module.exports.getToken = experiment => {
    return new Promise(resolve => {
        api.loginGetEditToken({
            username: experiment ? my.username2 : my.username,
            password: experiment ? my.password2 : my.password
        }).then(res => {
            if (!res) return resolve(console.log('An unexpected error occurred on login attempt.'));
            resolve(res.csrftoken);
        }).catch((err) => resolve(console.log(err.response.login.reason)));
    });
};

/**
 * @param {string} pagename
 * @returns {Promise<boolean|{basetimestamp: string, curtimestamp: string, content: string, revid: string}>} False if page doesn't exit, or else an object
 */
module.exports.getLatestRevision = pagename => {
    return new Promise(resolve => {
        api.request({
            action: 'query',
            titles: pagename,
            prop: 'revisions',
            rvprop: 'ids|timestamp|content',
            rvslots: 'main',
            curtimestamp: 1,
            formatversion: 2
        }).then(res => {
            if (!res || !res.query) return resolve();
            const resPages = res.query.pages;
            if (resPages.length === 0) return resolve();
            if (resPages[0].missing) return resolve(false);
            const resRev = resPages[0].revisions[0];
            resolve({
                'basetimestamp': resRev.timestamp,
                'curtimestamp': res.curtimestamp,
                'content': resRev.slots.main.content,
                'originalContent': JSON.parse(JSON.stringify(resRev.slots.main.content)),
                'revid': resRev.revid.toString()
            });
        }).catch(err => resolve(console.log(err)));
    });
};

/**
 * Make an intentional N-millisecond delay (must be awaited)
 * @param {number} milliseconds
 * @returns {Promise}
 */
module.exports.delay = milliseconds => new Promise(resolve =>  setTimeout(resolve, milliseconds));


// ****************************** SYNCHRONOUS FUNCTIONS ******************************

/** 
 * Extract templates from wikitext
 * @param {string} wikitext the wikitext from which templates are extracted
 * @param {string|Array} [templateName] sort out templates by these template names
 * @param {string|Array} [templatePrefix] sort out templates by these template prefixes
 * @returns {Array}
 */
function findTemplates(wikitext, templateName, templatePrefix) {

    // Create an array by splitting the original content with '{{'
    const tempInnerContents = wikitext.split('{{'); // Note: tempInnerContents[0] is always an empty string or a string that has nothing to do with templates
    if (tempInnerContents.length === 0) return [];

    // Extract templates from the wikitext
    var templates = [];
    const nest = [];
    tempInnerContents.forEach((tempInnerContent, i, arr) => { // Loop through all elements in tempInnerContents (except tempInnerContents[0])

        if (i === 0) return;

        const tempTailCnt = (tempInnerContent.match(/\}\}/g) || []).length; // The number of '}}' in the split array
        var temp = ''; // Temporary escape hatch

        // There's no '}}' (= nesting other templates)
        if (tempTailCnt === 0) {

            nest.push(i); // Save the index of the element in the array

        // There's one '}}' in the element of the array (= the left part of '}}' is the whole of the template's parameters)
        } else if (tempTailCnt === 1) {

            temp = '{{' + tempInnerContent.split('}}')[0] + '}}';
            if (!templates.includes(temp)) templates.push(temp);

        // There're two or more '}}'s (e.g. 'TL2|...}}...}}'; = templates are nested)
        } else {

            for (let j = 0; j < tempTailCnt; j++) {

                if (j === 0) { // The innermost template

                    temp = '{{' + tempInnerContent.split('}}')[j] + '}}'; // Same as when there's one '}}' in the element
                    if (!templates.includes(temp)) templates.push(temp);

                } else { // Multi-nested template(s)

                    const elNum = nest[nest.length -1]; // The index of the element that involves the start of the nest
                    nest.pop(); // The index won't be reused after reference
                    const nestedTempInnerContent = tempInnerContent.split('}}'); // Create another array by splitting with '}}'

                    temp = '{{' + arr.slice(elNum, i).join('{{') + '{{' + nestedTempInnerContent.slice(0, j + 1).join('}}') + '}}';
                    if (!templates.includes(temp)) templates.push(temp);

                }

            }

        }

    }); // All templates in the wikitext is stored in 'templates' when the loop is done

    // Remove templates that are part of comments
    const co = extractCommentOuts(wikitext);
    if (co) {
        co.forEach(item => {
            templates = templates.filter(template => item.indexOf(template) === -1);
        });
    }

    // End here if the templates don't need to be sorted
    if ((!templateName && !templatePrefix) || templates.length === 0) return templates;

    // Convert passed parameters to arrays if they are strings
    if (templateName && typeof templateName === 'string') templateName = [templateName];
    if (templatePrefix && typeof templatePrefix === 'string') templatePrefix = [templatePrefix];

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
    templates = templates.filter(item => {
        const name = item.match(/^\{{2}\s*([^\|\{\}\n]+)/)[1].trim(); // {{ TEMPLATENAME | ... }} の TEMPLATENAME を抽出
        if (templateName && templatePrefix) {
            return name.match(templateNameRegExp) || name.match(templatePrefixRegExp);
        } else if (templateName) {
            return name.match(templateNameRegExp);
        } else if (templatePrefix) {
            return name.match(templatePrefixRegExp);
        }
    });

    return templates;

}
module.exports.findTemplates = findTemplates;

/**
 * Get strings enclosed by <!-- -->, <nowiki />, <pre />, <syntaxhighlight />, and <source />
 * @param {string} wikitext 
 * @returns {Array|null} 
 */
function extractCommentOuts(wikitext) {
    return wikitext.match(/(<!--[\s\S]*?-->|<nowiki>[\s\S]*?<\/nowiki>|<pre[\s\S]*?<\/pre>|<syntaxhighlight[\s\S]*?<\/syntaxhighlight>|<source[\s\S]*?<\/source>)/gm);
}
module.exports.extractCommentOuts = extractCommentOuts;

/**
 * Get the parameters of templates as an array
 * @param {string} template 
 * @returns {Array} This doesn't contain the template's name
 */
function getTemplateParams(template) {

    // If the template doesn't contain '|', it doesn't have params
    if (template.indexOf('|') === -1) return [];

    // Remove the first '{{' and the last '}}' (or '|}}')
    const frameRegExp = /(?:^\{{2}|\|*\}{2}$)/g;
    var params = template.replace(frameRegExp, '');

    // In case the params nest other templates
    var nested = findTemplates(params);
    if (nested.length !== 0) {
        nested = nested.filter(item => { // Sort out templates that don't nest yet other templates (findTemplates() returns both TL1 and TL2
            return nested.filter(itemN => itemN !== item).every(itemN => itemN.indexOf(item) === -1); // ↳ in {{TL1| {{TL2}} }} ), but we don't need TL2 
            // ↳ Look at the other elements in the array 'nested' (.filter) and only preserve items that are not part of those items (.every)
        });
        nested.forEach((item, i) => {
            params = params.replaceAll(item, `$TL${i}`); // Replace nested templates with '$TLn'
        });
    }

    // Get an array of parameters
    params = params.split('|'); // This could be messed up if the nested templates hadn't been replaced
    params.shift(); // Remove the template name
    if (nested.length !== 0) {
        params.forEach((item, i) => {
            var m;
            if (m = item.match(/\$TL\d+/g)) { // Find all $TLn in the item
                for (let j = 0; j < m.length; j += 2) {
                    const index = m[j].match(/\$TL(\d+)/)[1];
                    m.splice(j + 1, 0, index); // Push the index at m[j + 1]
                    const replacee = j === 0 ? item : params[i];
                    params[i] = replacee.replaceAll(m[j], nested[m[j + 1]]);  // Re-replace delimiters with original templates
                }
            }
        });
    }

    return params;

}
module.exports.getTemplateParams = getTemplateParams;

/**
 * Extract all UserANs with open reports as an array
 * @param {string} wikitext 
 * @returns {Array}
 */
module.exports.getOpenUserANs = wikitext => {

    if (!wikitext) {
        console.log('lib.getOpenUserANs: The wikitext passed as an argument is an empty string or undefined.');
        return [];
    }

    // Get all UserANs in the wikitext
    const templates = findTemplates(wikitext, 'UserAN');
    if (templates.length === 0) return [];

    // Create an array of objects out of the 'templates' array
    var UserAN = [];
    templates.forEach(template => {
        UserAN.push({
            'template': template,
            'closed': true
        });
    });

    // RegExps to evaluate the templates' parameters
    const paramsRegExp = {
        'bot': /^\s*bot\s*=/, // bot=
        'type': /^\s*(?:t|[Tt]ype)\s*=/, // t=, type=, or Type=
        'statusS': /^\s*(?:状態|s|[Ss]tatus)\s*=\s*$/, // 状態=, s=, status=, or Status=
        'statusSClosed': /^\s*(?:状態|s|[Ss]tatus)\s*=\s*.+/, // Closed statusS
    };

    // Find UserANs with open reports by evaluating their parameters
    UserAN.forEach(obj => {

        // Get parameters
        var params = getTemplateParams(obj.template); // This doesn't include the template name
        if (params.length === 0) return;
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

        if (params.filter(item => item.match(paramsRegExp.statusSClosed)).length > 0) return; // 状態=X param is present: Always closed
        switch(params.length) {
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
                if (params.some(item => item.match(paramsRegExp.type)) && params.some(item => item.match(paramsRegExp.statusS))) obj.closed = false;
        }

    });

    return UserAN.filter(obj => !obj.closed).map(obj => obj.template);

};

/**
 * Split a string into two
 * @param {string} str 
 * @param {string} delimiter 
 * @param {boolean} lastindex If true, search the delimiter from the bottom of the string
 * @returns {Array}
 */
module.exports.splitInto2 = (str, delimiter, lastindex) => {
    const index = lastindex ? str.lastIndexOf(delimiter) : str.indexOf(delimiter);
    if (index === -1) return;
    const firstPart = str.substring(0, index);
    const secondPart = str.substring(index + 1);
    return [firstPart, secondPart];
};

/**
 * @param {string} timestamp1 
 * @param {string} timestamp2 
 * @param {boolean} [rewind5minutes] if true, rewind timestamp1 by 5 minutes
 * @returns {boolean} timestamp2 - timestamp1
 */
module.exports.compareTimestamps = (timestamp1, timestamp2, rewind5minutes) => {
    if (typeof timestamp1 === 'undefined' || typeof timestamp2 === 'undefined') return;
    const ts1 = new Date(timestamp1);
    if (rewind5minutes) ts1.setMinutes(ts1.getMinutes() - 5);
    const ts2 = new Date(timestamp2);
    const diff = ts2.getTime() - ts1.getTime();
    return diff;
};

/**
 * @param {string} timestamp1 
 * @param {string} timestamp2 
 * @returns {string}
 */
module.exports.getDuration = (timestamp1, timestamp2) => {

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

};

/**
 * Escapes \ { } ( ) . ? * + - ^ $ [ ] | (but not '!')
 * @param {string} str 
 * @returns 
 */
function escapeRegExp(str) {
    return str.replace(/[\\{}().?*+\-^$[\]|]/g, '\\$&');
}
module.exports.escapeRegExp = escapeRegExp;

/**
 * Get the last day of a given month
 * @param {number|string} year
 * @param {number|string} month 1-12
 * @returns {number}
 */
module.exports.lastDay = (year, month) => new Date(year, month, 0).getDate();

/**
 * Get the Japanese name of a day of the week from JSON timestamp
 * @param {string} timestamp 
 * @returns {string}
 */
module.exports.getWeekDayJa = timestamp => {
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    return daysOfWeek[new Date(timestamp).getDay()];
};

/**
 * Check if a string is an IP address
 * @param {string} ip 
 * @returns {boolean}
 */
module.exports.isIPAddress = ip => net.isIP(ip) || isCidr(ip);

/**
 * Check if a string is an IPv4 address
 * @param {string} ip 
 * @returns {boolean}
 */
module.exports.isIPv4 = ip => net.isIPv4(ip) || isCidr.v4(ip);

/**
 * Check if a string is an IPv6 address
 * @param {string} ip 
 * @returns {boolean}
 */
module.exports.isIPv6 = ip => net.isIPv6(ip) || isCidr.v6(ip);