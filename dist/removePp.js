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
Object.defineProperty(exports, "__esModule", { value: true });
exports.editPageWithPp = exports.removePp = void 0;
const lib = __importStar(require("./lib"));
const server_1 = require("./server");
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
    '保護',
    '保護S',
    '保護s',
    '全保護',
    '半保護',
    'Sprotected',
    '半保護S',
    '拡張半保護',
    '保護運用',
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
async function removePp(botRunTs) {
    (0, server_1.log)('Checking for pages with inappropriate protection templates...');
    // Get the titles of all pages that transclude protection templates
    const queries = [];
    for (const tl of pp.map(el => 'Template:' + el)) {
        queries.push(lib.getTranscludingPages(tl));
    }
    const result = await Promise.all(queries);
    const transcludingPp = result.flat().undup();
    // Filter out unprotected pages 
    const protectedPages = await lib.filterOutProtectedPages(transcludingPp);
    if (!protectedPages)
        return (0, server_1.log)('Failed to filter out protected pages.');
    let notProtected = transcludingPp.filter(el => !protectedPages.includes(el) && !ignore.includes(el));
    notProtected = notProtected.filter(el => {
        // Remove subpages of pp templates
        return pp.map(tl => 'Template:' + tl + '/').every(pfx => !el.includes(pfx));
    });
    (0, server_1.log)(`${notProtected.length} page(s) found.`);
    if (notProtected.length === 0)
        return;
    // Edit all the unprotected pages with protection templates
    for (const page of notProtected) {
        if (botRunTs && needToQuit(botRunTs)) {
            (0, server_1.log)('The next procedure starts within 10 seconds: Put off editing the rest of the pages.');
            break;
        }
        await editPageWithPp(page);
    }
}
exports.removePp = removePp;
/**
 * Check whether the next procedure starts in 10 seconds.
 * @param botRunTs The time at which the current procedure started; JSON timestamp
 */
function needToQuit(botRunTs) {
    const d = new Date();
    const dLimit = new Date(botRunTs);
    dLimit.setSeconds(dLimit.getSeconds() + 590); // 9m50s
    return d > dLimit;
}
/** Remove protection templates from a given page. */
async function editPageWithPp(pagetitle) {
    const lr = await lib.getLatestRevision(pagetitle);
    if (!lr)
        return (0, server_1.log)('Failed to parse the page.');
    let content = lr.content;
    const templates = lib.parseTemplates(content, {
        templatePredicate: (template) => {
            return pp.includes(template.name) && !template.arguments.some((obj) => /demolevel/i.test(obj.name));
        }
    })
        .map((template) => {
        // Filter out the template texts and convert them into RegExps
        return new RegExp(lib.escapeRegExp(template.text) + '[^\\S\\n\\r]*\\n?');
    });
    if (templates.length === 0)
        return (0, server_1.log)('No protection templates found.');
    // Replace "{{TEMPLATE}}\n" with an empty string
    content = lib.replaceWikitext(content, templates, '');
    // Remove empty <noinclude> tags and the like if there's any
    content = content.replace(/<noinclude>\s*?<\/noinclude>[^\S\n\r]*\n?/gm, '').replace(/\/\*\s*?\*\/[^\S\n\r]*\n?/gm, '');
    if (content === lr.content)
        return (0, server_1.log)('Procedure cancelled: Same content');
    const params = {
        title: pagetitle,
        text: content,
        summary: 'Bot: 保護テンプレートの除去',
        minor: true,
        bot: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp
    };
    await lib.edit(params);
}
exports.editPageWithPp = editPageWithPp;
