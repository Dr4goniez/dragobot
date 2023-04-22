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
 * Get a list of pages that have inappropriate protection templates and remove them all.
 * @param botRunTs Timestamp of when the bot started the current procedure: if provided, quit function 10 seconds before the next procedure starts.
 */
export async function removePp(botRunTs?: string): Promise<void> {

    log('Checking for pages with inappropriate protection templates...');

    // Get the titles of all pages that transclude protection templates
    const queries = [];
    for (const tl of pp.map(el => 'Template:' + el)) {
        queries.push(lib.getTranscludingPages(tl));
    }
    const result = await Promise.all(queries);
    const transcludingPp = result.reduce((acc: string[], arr) => { // flat and remove duplicates
        arr.forEach((pagetitle) => {
            if (!acc.includes(pagetitle)) acc.push(pagetitle);
        });
        return acc;
    }, []);

    // Filter out unprotected pages 
    const protectedPages = await lib.filterOutProtectedPages(transcludingPp);
    if (!protectedPages) return log('Failed to filter out protected pages.');
    let notProtected = transcludingPp.filter(el => !protectedPages.includes(el) && !ignore.includes(el));
    notProtected = notProtected.filter(el => {
        // Remove subpages of pp templates
        return pp.map(tl => 'Template:' + tl + '/').every(pfx => !el.includes(pfx));
    });

    log(`${notProtected.length} page(s) found.`);
    if (notProtected.length === 0) return;

    // Edit all the unprotected pages with protection templates
    for (const page of notProtected) {
        if (botRunTs && needToQuit(botRunTs)) {
            log('The next procedure starts within 10 seconds: Put off editing the rest of the pages.');
            break;
        }
        const result = await editPageWithPp(page);
        if (result === null) ignore.push(page);
    }

}

/** 
 * Check whether the next procedure starts in 10 seconds.
 * @param botRunTs The time at which the current procedure started; JSON timestamp
 */
function needToQuit(botRunTs: string): boolean {
    const d = new Date();
    const dLimit = new Date(botRunTs);
    dLimit.setSeconds(dLimit.getSeconds() + 590); // 9m50s
    return d > dLimit;
}

/**
 * Remove protection templates from a given page.
 * @returns Null if the page can't be edited.
 */
export async function editPageWithPp(pagetitle: string): Promise<void|null> {

    const lr = await lib.getLatestRevision(pagetitle);
    if (!lr) return log(`${pagetitle}: Failed to parse the page.`);
    let content = lr.content;

    const templates = lib.parseTemplates(content, {
        templatePredicate: (template) => {
            return pp.includes(template.name) && !template.arguments.some((obj: lib.TemplateArgument) => /demolevel/i.test(obj.name));
        }
    })
    .map((template) => {
        // Filter out the template texts and convert them into RegExps
        return new RegExp(lib.escapeRegExp(template.text) + '[^\\S\\n\\r]*\\n?');
    });
    if (templates.length === 0) {
        log(`${pagetitle}: No protection templates found.`);
        return null;
    }

    // Replace "{{TEMPLATE}}\n" with an empty string
    content = lib.replaceWikitext(content, templates, '');

    // Remove empty <noinclude> tags and the like if there's any
    content = content.replace(/<noinclude>\s*?<\/noinclude>[^\S\n\r]*\n?/gm, '').replace(/\/\*\s*?\*\/[^\S\n\r]*\n?/gm, '');

    if (content === lr.content) {
        log(`${pagetitle}: Procedure cancelled: Same content`);
        return null;
    }

    const params = {
        title: pagetitle,
        text: content,
        summary: 'Bot: [[Template:Pp|保護テンプレート]]の除去',
        minor: true,
        bot: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp
    };
    await lib.edit(params);

}