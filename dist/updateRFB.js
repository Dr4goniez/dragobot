"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRFB = void 0;
const server_1 = require("./server");
const wikitext_1 = require("./wikitext");
const lib_1 = require("./lib");
/** Do a monthly update of RFB-related pages. */
async function updateRFB(testrun = false) {
    (0, server_1.log)('Starting monthly update of RFB-replated pages...');
    /************************************************************************************
     * List of pages that need to be updated
       * Monthly
         * Wikipedia:投稿ブロック依頼 YYYY年MM月 - create
         * Template:投稿ブロック依頼 - update links in {{topicpath-sub}}
         * Wikipedia:投稿ブロック依頼 - update links in the '依頼' section
       * Annually
         * Wikipedia:投稿ブロック依頼 YYYY年 - create
         * Template:投稿ブロック依頼過去ログ - update links
     ************************************************************************************/
    // Get years and months
    const dt = new Date();
    if (!testrun) {
        dt.setHours(dt.getHours() + 9); // JST: Needed only on Toolforge server
    }
    const curYear = dt.getFullYear();
    const curMonth = dt.getMonth() + 1;
    const d = {
        last: {
            year: curMonth === 1 ? curYear - 1 : curYear,
            month: curMonth === 1 ? 12 : curMonth - 1
        },
        current: {
            year: curYear,
            month: curMonth
        },
        next: {
            year: curMonth === 12 ? curYear + 1 : curYear,
            month: curMonth === 12 ? 1 : curMonth + 1
        }
    };
    // Create [[Wikipedia:投稿ブロック依頼 YYYY年MM月]]
    const createMonthlySubpage = async () => {
        const pagetitle = `Wikipedia:投稿ブロック依頼 ${d.next.year}年${d.next.month}月`;
        (0, server_1.log)(`Creating ${pagetitle}...`);
        const revision = await wikitext_1.Wikitext.fetch(pagetitle); // Check existence
        if (revision) { // Already exists
            return (0, server_1.log)(`Cancelled: ${pagetitle} already exists.`);
        }
        else if (revision === null) { // Query failed
            return (0, server_1.log)(`Cancelled: failed to get the existence of ${pagetitle}.`);
        }
        else { // Doesn't exist
            await (0, lib_1.edit)({
                title: pagetitle,
                text: '{{投稿ブロック依頼}}\n== ログ ==\n\n== 依頼 ==',
                summary: 'Bot: 月次更新処理',
                bot: true
            });
        }
    };
    await createMonthlySubpage();
    // Update [[Template:投稿ブロック依頼]] and [[Wikipedia:投稿ブロック依頼]]
    /**
     * @param y
     * @param m
     * @param appendYear Add 'MMMM年 ' to the returned string if true
     * @returns [[Wikipedia:投稿ブロック依頼 y年m月|m月]]
     */
    const getLink = (y, m, appendYear) => {
        return `${appendYear && m == 1 ? `${y}年 ` : ''}[[Wikipedia:投稿ブロック依頼 ${y}年${m}月|${m}月]]`;
    };
    const updateLinks = async (pagetitle, linktype) => {
        (0, server_1.log)(`Updating links on ${pagetitle}...`);
        const lr = await wikitext_1.Wikitext.fetch(pagetitle);
        if (!lr)
            return (0, server_1.log)('Failed to get the lastest revision of ' + pagetitle);
        let content = lr.content;
        const newLink = getLink(d[linktype].year, d[linktype].month, true);
        if (content.includes(getLink(d[linktype].year, d[linktype].month))) {
            return (0, server_1.log)('Cancelled: Links have already been updated.');
        }
        const linkRegex = /\[\[[Ww]ikipedia:投稿ブロック依頼 \d{4}年\d{1,2}月\|\d{1,2}月\]\]/g;
        const mOldLinks = content.match(linkRegex);
        if (mOldLinks) { // Links found - just add a link for the new month next to them
            const oldLink = mOldLinks[mOldLinks.length - 1];
            content = content.replace(oldLink, oldLink + ' - ' + newLink);
        }
        else if (/^Wikipedia:/.test(pagetitle)) { // Links not found and the Wikipedia namespace - reconstruct page
            const lines = [
                '{{投稿ブロック依頼|}}',
                '== 依頼 ==',
                "'''新しい依頼は[[Wikipedia:投稿ブロック依頼 {{#time:Y年n月|+9 hours}}]]に追加してください。'''",
                `* ${d[linktype].year}年 ${getLink(d[linktype].year, d[linktype].month)}`,
                '<!-- 上記の各月リンク先を編集する場合、連動して[[Template:投稿ブロック依頼]]の編集も必要となります -->',
                '{{投稿ブロック依頼過去ログ|}}',
                '{{DEFAULTSORT:とうこうふろつくいらい}}',
                '[[Category:投稿ブロック]]',
                '[[Category:投稿ブロック依頼|*]]'
            ];
            content = lines.join('\n');
        }
        else { // Links not found - impossible to proceed
            return (0, server_1.log)('Cancelled: No replacee link found.');
        }
        if (content === lr.content)
            return (0, server_1.log)(pagetitle + ': Edit cancelled (same content).');
        await (0, lib_1.edit)({
            title: pagetitle,
            text: content,
            summary: 'Bot: 月次更新処理',
            bot: true,
            minor: true,
            basetimestamp: lr.basetimestamp,
            starttimestamp: lr.curtimestamp
        });
    };
    const pages = [`Template:投稿ブロック依頼`, `Wikipedia:投稿ブロック依頼`];
    for (let i = 0; i < pages.length; i++) {
        const linktype = i === 0 ? 'next' : 'current';
        await updateLinks(pages[i], linktype);
    }
    if (d.next.month !== 1)
        return;
    const createNewAnnualSubpage = async () => {
        const pagetitle = `Wikipedia:投稿ブロック依頼 ${d.next.year}年`;
        (0, server_1.log)(`Creating ${pagetitle}...`);
        const lr = await wikitext_1.Wikitext.fetch(pagetitle);
        if (lr) {
            return (0, server_1.log)(`Cancelled: ${pagetitle} already exists.`);
        }
        else if (lr === null) {
            return (0, server_1.log)(`Cancelled: failed to get the existence of ${pagetitle}.`);
        }
        let content = '__NOTOC__\n<!--\n';
        for (let i = 1; i <= 12; i++) {
            content += '{{' + pagetitle + i + '月}}\n';
        }
        content +=
            '-->\n' +
                '{{投稿ブロック依頼過去ログ}}\n' +
                '<!-- 本ページでの直接節編集が可能なように、月別の見出し（例：「== 1月 ==」）は各ページ内に設定してください。 -->\n' +
                `<noinclude>[[Category:投稿ブロック依頼|済 ${d.next.year}]]</noinclude>`;
        await (0, lib_1.edit)({
            title: pagetitle,
            text: content,
            summary: 'Bot: 年次更新処理',
            bot: true
        });
    };
    await createNewAnnualSubpage();
    const updateArchiveTemplte = async () => {
        const pagetitle = `Template:投稿ブロック依頼過去ログ`;
        (0, server_1.log)(`Updating links on ${pagetitle}...`);
        const lr = await wikitext_1.Wikitext.fetch(pagetitle);
        if (!lr)
            return (0, server_1.log)('Failed to get the lastest revision of ' + pagetitle);
        let content = lr.content;
        const getAnnualLink = (y) => `[[Wikipedia:投稿ブロック依頼 ${y}年|${y}年]]`;
        const linkOldYear = getAnnualLink(d.current.year);
        const linkNewYear = getAnnualLink(d.next.year);
        if (content.includes(linkNewYear))
            return (0, server_1.log)('Cancelled: Links have already been updated.');
        content = content.replace(linkOldYear, linkOldYear + ' - ' + linkNewYear);
        await (0, lib_1.edit)({
            title: pagetitle,
            text: content,
            summary: 'Bot: 年次更新処理',
            bot: true,
            minor: true,
            basetimestamp: lr.basetimestamp,
            starttimestamp: lr.curtimestamp
        });
    };
    await updateArchiveTemplte();
}
exports.updateRFB = updateRFB;
