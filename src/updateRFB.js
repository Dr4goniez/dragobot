import * as lib from './lib';
import { log } from './server';

/**
 * Monthly update of RFB-related pages
 * @returns {Promise<void>}
 */
async function updateRFB() {

    log('Starting monthly update of RFB-replated pages...');

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
    dt.setHours(dt.getHours() + 9); // e.g. 2022-07-31T23:35:00Z
    const curYear = dt.getFullYear(),
          curMonth = dt.getMonth() + 1;
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
    const testPagePrefix = ''; // For debugging

    // Create [[Wikipedia:投稿ブロック依頼 YYYY年MM月]]
    const createMonthlySubpage = async () => {

        const pagetitle = `${testPagePrefix}Wikipedia:投稿ブロック依頼 ${d.next.year}年${d.next.month}月`;
        log(`Creating ${pagetitle}...`);
        const lr = await lib.getLatestRevision(pagetitle);
        if (lr) return log(`Cancelled: ${pagetitle} already exists.`);
        if (lr === undefined) return;
        const params = {
            title: pagetitle,
            text: '{{投稿ブロック依頼}}\n== ログ ==\n\n== 依頼 ==',
            summary: 'Bot: 月次更新処理',
            bot: true
        };
        await lib.edit(params);

    };
    await createMonthlySubpage();

    // Update [[Template:投稿ブロック依頼]] and [[Wikipedia:投稿ブロック依頼]]

    /**
     * @param {string|number} y
     * @param {string|number} m
     * @param {boolean} [appendYear] Add 'MMMM年 ' to the returned string if true
     * @returns {string} [[Wikipedia:投稿ブロック依頼 y年m月|m月]]
     */
    const getLink = (y, m, appendYear) => `${appendYear && m == 1 ? `${y}年 ` : ''}[[Wikipedia:投稿ブロック依頼 ${y}年${m}月|${m}月]]`;

    /**
     * @param {string} pagetitle
     * @param {string} linktype 'next' or 'current'
     * @returns
     */
    const updateLinks = async (pagetitle, linktype) => {

        log(`Updating links on ${pagetitle}...`);
        const lr = await lib.getLatestRevision(pagetitle);
        if (!lr) return log('Failed to get the lastest revision of ' + pagetitle);

        var content = lr.content;
        const lkNew = getLink(d[linktype].year, d[linktype].month, true);
        if (content.includes(getLink(d[linktype].year, d[linktype].month))) {
            return log('Cancelled: Links have already been updated.');
        }
        const linkRegex = /\[\[[Ww]ikipedia:投稿ブロック依頼 \d{4}年\d{1,2}月\|\d{1,2}月\]\]/g;
        var lkOld = content.match(linkRegex);
        if (!lkOld) return log('Cancelled: No replacee link found.');
        lkOld = lkOld[lkOld.length - 1];
        content = content.replace(lkOld, lkOld + ' - ' + lkNew);
        if (content === lr.content) return log(pagetitle + ': Edit cancelled (same content).');

        const params = {
            title: pagetitle,
            text: content,
            summary: 'Bot: 月次更新処理',
            bot: true,
            minor: true,
            basetimestamp: lr.basetimestamp,
            starttimestamp: lr.curtimestamp
        };
        await lib.edit(params);

    };

    const pages = [`${testPagePrefix}Template:投稿ブロック依頼`, `${testPagePrefix}Wikipedia:投稿ブロック依頼`];
    for (let i = 0; i < pages.length; i++) {
        const linktype = i === 0 ? 'next' : 'current';
        await updateLinks(pages[i], linktype);
    }
    if (d.next.month !== 1) return;

    const createNewAnnualSubpage = async () => {

        const pagetitle = `${testPagePrefix}Wikipedia:投稿ブロック依頼 ${d.next.year}年`;
        log(`Creating ${pagetitle}...`);
        const lr = await lib.getLatestRevision(pagetitle);
        if (lr) return log(`Cancelled: ${pagetitle} already exists.`);
        if (lr === undefined) return;

        var content = '__NOTOC__\n<!--\n';
        for (let i = 1; i <= 12; i++) {
            content += '{{' + pagetitle + i + '月}}\n';
        }
        content +=
        '-->\n' +
        '{{投稿ブロック依頼過去ログ}}\n' +
        '<!-- 本ページでの直接節編集が可能なように、月別の見出し（例：「== 1月 ==」）は各ページ内に設定してください。 -->\n' +
        `<noinclude>[[Category:投稿ブロック依頼|済 ${d.next.year}]]</noinclude>`;

        const params = {
            title: pagetitle,
            text: content,
            summary: 'Bot: 年次更新処理',
            bot: true
        };
        await lib.edit(params);

    };
    await createNewAnnualSubpage();

    const updateArchiveTemplte = async () => {

        const pagetitle = `${testPagePrefix}Template:投稿ブロック依頼過去ログ`;
        log(`Updating links on ${pagetitle}...`);
        const lr = await lib.getLatestRevision(pagetitle);
        if (!lr) return log('Failed to get the lastest revision of ' + pagetitle);

        var content = lr.content;
        const getAnnualLink = y => `[[Wikipedia:投稿ブロック依頼 ${y}年|${y}年]]`;
        const lkOldYear = getAnnualLink(d.current.year),
              lkNewYear = getAnnualLink(d.next.year);
        if (content.includes(lkNewYear)) return log('Cancelled: Links have already been updated.');
        content = content.replace(lkOldYear, lkOldYear + ' - ' + lkNewYear);

        const params = {
            title: pagetitle,
            text: content,
            summary: 'Bot: 年次更新処理',
            bot: true,
            minor: true,
            basetimestamp: lr.basetimestamp,
            starttimestamp: lr.curtimestamp
        };
        await lib.edit(params);

    };
    await updateArchiveTemplte();

}
export { updateRFB };