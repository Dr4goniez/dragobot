const my = require('./my');
const MWBot = require('mwbot');
const api = new MWBot({
    apiUrl: my.apiUrl
});

/** 
 * Extract templates from wikitext
 * @param {string} wikitext
 * @param {string} [templateName] The first letter is case-insensitive
 * @returns {Array}
 */
module.exports.findTemplates = (wikitext, templateName) => {

    // Split the wikitext with '{{', the head delimiter of templates
    const tempInnerContent = wikitext.split('{{'); // Note: tempInnerContent[0] has always nothing to do with templates
    if (tempInnerContent.length === 0) return [];
    var templates = [];
    const nest = []; // Stores the element number of tempInnerContent if the element involves nested templates

    // Extract templates from the wikitext
    for (let i = 1; i < tempInnerContent.length; i++) {

        let tempTailCnt = (tempInnerContent[i].match(/\}\}/g) || []).length; // The number of '}}' in the split segment
        let temp = ''; // Temporary escape hatch

        // The split segment not having any '}}' (= it nests another template)
        if (tempTailCnt === 0) {

            nest.push(i); // Push the element number into the array

        // The split segment itself is the whole inner content of one template
        } else if (tempTailCnt === 1) {

            temp = '{{' + tempInnerContent[i].split('}}')[0] + '}}';
            if (!templates.includes(temp)) templates.push(temp);

        // The split segment is part of more than one template (e.g. TL2|...}}...}} )
        } else {

            for (let j = 0; j < tempTailCnt; j++) { // Loop through all the nests

                if (j === 0) { // The innermost template

                    temp = '{{' + tempInnerContent[i].split('}}')[j] + '}}'; // Same as when tempTailCnt === 1
                    if (!templates.includes(temp)) templates.push(temp);

                } else { // Nesting templates

                    const elNum = nest[nest.length -1]; // The start of the nesting template
                    nest.pop();
                    const nestedTempInnerContent = tempInnerContent[i].split('}}');

                    temp = '{{' + tempInnerContent.slice(elNum, i).join('{{') + '{{' + nestedTempInnerContent.slice(0, j + 1).join('}}') + '}}';
                    if (!templates.includes(temp)) templates.push(temp);

                }

            }

        }

    }

    // Check if the optional parameter is specified
    if (templateName && templates.length !== 0) {
        const caseInsensitiveFirstLetter = str => '[' + str.substring(0, 1).toUpperCase() + str.substring(0, 1).toLowerCase() + ']';
        const templateRegExp = new RegExp('^\\s*\{\{\\s*' + caseInsensitiveFirstLetter(templateName) + templateName.substring(1));
        templates = templates.filter(item => item.match(templateRegExp)); // Only leave the specified template in the array
    }

    return templates;

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
 * @param {string} pagename
 * @returns {Promise<{basetimestamp: string, curtimestamp: string, content: string}>}
 */
module.exports.getLatestRevision = pagename => {
    return new Promise(resolve => {
        api.request({
            action: 'query',
            titles: pagename,
            prop: 'revisions',
            rvprop: 'timestamp|content',
            rvslots: 'main',
            curtimestamp: 1,
            formatversion: 2
        }).then(res => {
            if (!res || !res.query) return resolve();
            const resRev = res.query.pages[0].revisions[0];
            resolve({
                basetimestamp: resRev.timestamp,
                curtimestamp: res.curtimestamp,
                content: resRev.slots.main.content
            });
        }).catch(() => resolve());
    });
};

/**
 * @param {string} timestamp1 
 * @param {string} timestamp2 
 * @returns {boolean} true if positive, false if negative
 */
module.exports.compareTimestamps = (timestamp1, timestamp2) => {
    if (typeof timestamp1 === 'undefined' || typeof timestamp2 === 'undefined') return;
    const ts1 = new Date(timestamp1);
    const ts2 = new Date(timestamp2);
    const diff = ts2.getTime() - ts1.getTime();
    return diff > 0;
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