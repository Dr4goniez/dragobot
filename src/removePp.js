import * as lib from './lib';
import { log } from './server';

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
 * @param {string} [botRunTs] Timestamp of when the bot started the current procedure: if provided, quit function 10 seconds before the next procedure starts
 * @returns {Promise<void>}
 */
async function removePp(botRunTs) {

    log('Checking for pages with inappropriate protection templates...');

    const queries = [];
    for (const tl of pp.map(el => 'Template:' + el)) {
        queries.push(lib.getTranscludingPages(tl));
    }
    const result = await Promise.all(queries);
    const transcludingPp = result.flat().undup();

    const protectedPages = await lib.filterOutProtectedPages(transcludingPp);
    if (!protectedPages) return log('Failed to filter out protected pages.');
    var notProtected = transcludingPp.filter(el => !protectedPages.includes(el) && !ignore.includes(el));
    notProtected = notProtected.filter(el => {
        return pp.map(tl => 'Template:' + tl + '/').every(pfx => !el.includes(pfx)); // Remove subpages of pp templates
    });

    log(`${notProtected.length} page(s) found.`);
    if (notProtected.length === 0) return;

    for (const page of notProtected) {
        if (botRunTs && needToQuit(botRunTs)) {
            log('The next procedure starts within 10 seconds: Put off editing the rest of the pages.');
            break;
        }
        await editPageWithPp(page);

    }

}
export { removePp };

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
 * @returns {Promise} API response of action=edit or null
 */
async function editPageWithPp(pagetitle) {

    const lr = await lib.getLatestRevision(pagetitle);
    if (!lr) return log('Failed to parse the page.');
    var content = lr.content;

    var templates = lib.findTemplates(content, pp);
    if (templates.length === 0) return log('No protection templates found.');

    const isDemo = templates.some(el => {
        const params = lib.getTemplateParams(el);
        return params.some(param => param.match(/^demolevel\s*=/i));
    });
    if (isDemo) {
        ignore.push(pagetitle);
        return log('Cancelled: The pp in this page is used as a demo.');
    }

    // Escape the extracted templates
    templates = templates.map(function(item) {
        return lib.escapeRegExp(item);
    });

    // Replace "{{TEMPLATE}}\n" with an empty string
    const regex = new RegExp('(?:' + templates.join('|') + ')[^\\S\\n\\r]*\\n?', 'g');
    content = content.replace(regex, '');

    // Remove empty <noinclude> tags and the like if there's any
    content = content.replace(/<noinclude>(?:\s)*?<\/noinclude>[^\S\n\r]*\n?/gm, '').replace(/\/\*(?:\s)*?\*\/[^\S\n\r]*\n?/gm, '');

    if (content === lr.content) return log('Procedure cancelled: Same content');

    const params = {
        title: pagetitle,
        text: content,
        summary: 'Bot: 保護テンプレートの除去',
        minor: true,
        bot: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp
    };

    const editRes = await lib.edit(params);
    return editRes;

}
export { editPageWithPp };