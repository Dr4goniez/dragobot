const lib = require('./lib');

const pp = [
    'Pp',
    'Pp-dispute',
    'Pp-move',
    'Pp-move-dispute',
    'Pp-move-vandalism',
    'Pp-move-vand',
    'Pp-move-vd',
    'Pp-office',
    'Pp-office-dmca',
    'Pp-permanent',
    'Pp-reset',
    'Pp-semi-indef',
    'Pp-template',
    'Pp-vandalism',
    'Pp-vand',
    'Pp-vd',
    '保護', // Master
    '保護S',
    '保護s',
    '全保護',
    '半保護', // Master
    'Sprotected',
    '半保護S',
    '拡張半保護', // Master
    '保護運用', // Master
    '半保護運用',
    '半永久保護',
    '移動保護',
    '移動拡張半保護'
];

const ignore = [
    'Wikipedia:主要なテンプレート/メンテナンス',
    'Template‐ノート:Pp/testcases',
    'Template:Pp-meta/sandbox'
];

/**
 * @param {string} token
 * @param {string} [botRunTs] Timestamp of when the bot started the current procedure: if provided, quit function 10 seconds before the next procedure starts
 * @param {string} [edittedTs] Timestamp of last edit
 * @returns {Promise<undefined|{edittedTs: string|undefined, token: string|null}>} editedTs has a value only if at least one page is edited, and token has
 * a value only if re-logged in
 */
async function removePp(token, botRunTs, edittedTs) {

    console.log('Checking for pages with inappropriate protection templates...');

    const queries = [];
    for (const tl of pp.map(el => 'Template:' + el)) {
        queries.push(lib.getTranscludingPages(tl));
    }
    const result = await Promise.all(queries);
    const transcludingPp = result.concat.apply([], result).filter((el, i, arr) => arr.indexOf(el) === i);

    const protected = await lib.filterOutProtectedPages(transcludingPp);
    if (!protected) return console.log('Failed to filter out protected pages.');
    var notProtected = transcludingPp.filter(el => protected.indexOf(el) === -1 && !ignore.includes(el));
    notProtected = notProtected.filter(el => {
        return pp.map(tl => 'Template:' + tl + '/').every(pfx => el.indexOf(pfx) === -1); // Remove subpages of pp templates
    });

    console.log(`${notProtected.length} page(s) found.`);
    if (notProtected.length === 0) return;

    var reloggedin = false;
    for (const page of notProtected) {
        if (botRunTs && needToQuit(botRunTs)) {
            console.log('The next procedure starts within 10 seconds: Put off editting the rest of the pages.');
            break;
        }
        console.log('Editing ' + page + '...');
        const result = await editPageWithPp(page, token, edittedTs);
        edittedTs = result ? result : edittedTs;
        if (result === null) {
            console.log('Edit token seems to have expired. Re-logging in...');
            reloggedin = true;
            token = await lib.getToken();
        }
    }

    return {
        edittedTs: edittedTs,
        token : reloggedin ? token : null
    };

}
module.exports.removePp = removePp;

/**
 * Check whether the next procedure starts in 10 seconds
 * @param {string} botRunTs 
 * @returns {boolean}
 */
function needToQuit(botRunTs) {
    const d = new Date();
    const dLimit = new Date(botRunTs);
    dLimit.setSeconds(dLimit.getSeconds() + 590); // 9m50s
    return d > dLimit;
}

/**
 * @param {string} pagetitle 
 * @param {string} token 
 * @param {string} [edittedTs] 
 * @returns {Promise<string|null|undefined>} JSON timestamp if the edit succeeded, or else undefined (null if re-login is needed)
 */
async function editPageWithPp(pagetitle, token, edittedTs) {

    const lr = await lib.getLatestRevision(pagetitle);
    if (!lr) return console.log('Failed to parse the page.');

    var templates = lib.findTemplates(lr.content, pp);
    if (templates.length === 0) {
        return console.log('No protection templates found.');
    } else {

        const isDemo = templates.some(el => {
            const params = lib.getTemplateParams(el);
            return params.some(param => param.match(/^demolevel\s*=/i));
        });
        if (isDemo) {
            ignore.push(pagetitle);
            return console.log('Cancelled: The pp in this page is used as a demo.');
        }

        // Escape the extracted templates
        templates = templates.map(function(item) {
            return lib.escapeRegExp(item);
        });

        // Replace "{{TEMPLATE}}\n" with an empty string
        const regex = new RegExp('(?:' + templates.join('|') + ')[^\\S\\n\\r]*\\n?', 'g');
        lr.content = lr.content.replace(regex, '');

        // Remove empty <noinclude> tags and the like if there's any
        lr.content = lr.content.replace(/<noinclude>(?:\s)*?<\/noinclude>[^\S\n\r]*\n?/gm, '').replace(/\/\*(?:\s)*?\*\/[^\S\n\r]*\n?/gm, '');

    }
    if (lr.content === lr.originalContent) return console.log('Procedure cancelled: Same content');

    const params = {
        action: 'edit',
        title: pagetitle,
        text: lr.content,
        summary: 'Bot: 保護テンプレートの除去',
        minor: true,
        bot: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp,
        token: token
    };

    const ts = await lib.editPage(params, edittedTs);
    return ts;

}