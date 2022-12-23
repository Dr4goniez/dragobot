"use strict";
<<<<<<< HEAD
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
=======
Object.defineProperty(exports, "__esModule", { value: true });
exports.editPageWithPp = exports.removePp = void 0;
const lib_1 = require("./lib");
>>>>>>> e20741e67557995b05ae68e0e9417acdb9ee60c6
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
<<<<<<< HEAD
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
=======
 * @param {string} [botRunTs] Timestamp of when the bot started the current procedure: if provided, quit function 10 seconds before the next procedure starts
 * @returns {Promise<void>}
 */
async function removePp(botRunTs) {
    (0, server_1.log)('Checking for pages with inappropriate protection templates...');
    const queries = [];
    for (const tl of pp.map(el => 'Template:' + el)) {
        queries.push(lib_1.lib.getTranscludingPages(tl));
    }
    const result = await Promise.all(queries);
    const transcludingPp = result.flat().undup();
    const protectedPages = await lib_1.lib.filterOutProtectedPages(transcludingPp);
    if (!protectedPages)
        return (0, server_1.log)('Failed to filter out protected pages.');
    var notProtected = transcludingPp.filter(el => !protectedPages.includes(el) && !ignore.includes(el));
    notProtected = notProtected.filter(el => {
        return pp.map(tl => 'Template:' + tl + '/').every(pfx => !el.includes(pfx)); // Remove subpages of pp templates
>>>>>>> e20741e67557995b05ae68e0e9417acdb9ee60c6
    });
    (0, server_1.log)(`${notProtected.length} page(s) found.`);
    if (notProtected.length === 0)
        return;
<<<<<<< HEAD
    // Edit all the unprotected pages with protection templates
=======
>>>>>>> e20741e67557995b05ae68e0e9417acdb9ee60c6
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
<<<<<<< HEAD
 * Check whether the next procedure starts in 10 seconds.
 * @param botRunTs The time at which the current procedure started; JSON timestamp
=======
 * Check whether the next procedure starts in 10 seconds
 * @param {string} botRunTs
 * @returns {boolean}
>>>>>>> e20741e67557995b05ae68e0e9417acdb9ee60c6
 */
function needToQuit(botRunTs) {
    const d = new Date();
    const dLimit = new Date(botRunTs);
    dLimit.setSeconds(dLimit.getSeconds() + 590); // 9m50s
    return d > dLimit;
}
<<<<<<< HEAD
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
=======
/**
 * @param {string} pagetitle
 * @returns {Promise} API response of action=edit or null
 */
async function editPageWithPp(pagetitle) {
    const lr = await lib_1.lib.getLatestRevision(pagetitle);
    if (!lr)
        return (0, server_1.log)('Failed to parse the page.');
    var content = lr.content;
    var templates = lib_1.lib.findTemplates(content, pp);
    if (templates.length === 0)
        return (0, server_1.log)('No protection templates found.');
    const isDemo = templates.some(el => {
        const params = lib_1.lib.getTemplateParams(el);
        return params.some(param => param.match(/^demolevel\s*=/i));
    });
    if (isDemo) {
        ignore.push(pagetitle);
        return (0, server_1.log)('Cancelled: The pp in this page is used as a demo.');
    }
    // Escape the extracted templates
    templates = templates.map(function (item) {
        return lib_1.lib.escapeRegExp(item);
    });
    // Replace "{{TEMPLATE}}\n" with an empty string
    const regex = new RegExp('(?:' + templates.join('|') + ')[^\\S\\n\\r]*\\n?', 'g');
    content = content.replace(regex, '');
    // Remove empty <noinclude> tags and the like if there's any
    content = content.replace(/<noinclude>(?:\s)*?<\/noinclude>[^\S\n\r]*\n?/gm, '').replace(/\/\*(?:\s)*?\*\/[^\S\n\r]*\n?/gm, '');
>>>>>>> e20741e67557995b05ae68e0e9417acdb9ee60c6
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
<<<<<<< HEAD
    await lib.edit(params);
=======
    const editRes = await lib_1.lib.edit(params);
    return editRes;
>>>>>>> e20741e67557995b05ae68e0e9417acdb9ee60c6
}
exports.editPageWithPp = editPageWithPp;
