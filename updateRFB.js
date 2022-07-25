/********************** DEPENDENCIES **********************/

const lib = require('./lib');

/********************** SCRIPT BODY **********************/

/**
 * Monthly update of RFB-related pages
 * @param {string} token 
 * @param {string} [edittedTs] 
 * @returns {Promise<string|undefined>} JSON timestamp if any page is editted, or else undefined
 */
async function updateRFB(token, edittedTs) {

    console.log('Starting monthly update of RFB-replated pages...');
    if (typeof edittedTs === 'undefined') var edittedTs;
    var ts = edittedTs ? edittedTs : undefined;

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

    // Create [[Wikipedia:投稿ブロック依頼 YYYY年MM月]]
    const createMonthlySubpage = async () => {

        const pagetitle = `Wikipedia:投稿ブロック依頼 ${d.next.year}年${d.next.month}月`;
        console.log(`Creating ${pagetitle}...`);
        if (ts) await lib.dynamicDelay(ts);
        const lr = await lib.getLatestRevision(pagetitle);
        if (lr) return console.log(`Cancelled: ${pagetitle} already exists.`);
        if (lr === undefined) return;
        const params = {
            'action': 'edit',
            'title': pagetitle,
            'text': '{{投稿ブロック依頼}}\n== ログ ==\n\n== 依頼 ==',
            'summary': 'Bot: 月次更新処理',
            'bot': true,
            'token': token
        };
        ts = await lib.editPage(params);

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
     * @param {Array} linktype ['current', 'next'] or ['last', 'current']
     * @returns 
     */
    const updateLinks = async (pagetitle, linktype) => {

        console.log(`Updating links on ${pagetitle}...`);
        if (ts) await lib.dynamicDelay(ts);
        const lr = await lib.getLatestRevision(pagetitle);
        if (!lr) return console.error('Failed to get the lastest revision of ' + pagetitle);

        var content = JSON.parse(JSON.stringify(lr.content));
        const lkOld = getLink(d[linktype[0]].year, d[linktype[0]].month),
              lkNew = getLink(d[linktype[1]].year, d[linktype[1]].month, true);
        if (content.indexOf(getLink(d[linktype[1]].year, d[linktype[1]].month)) !== -1) {
            return console.log('Cancelled: Links have already been updated.');
        }
        content = content.replace(lkOld, lkOld + ' - ' + lkNew);
        if (content === lr.content) return console.log(pagetitle + ': Edit cancelled (same content).');

        const params = {
            'action': 'edit',
            'title': pagetitle,
            'text': content,
            'summary': 'Bot: 月次更新処理',
            'bot': true,
            'minor': true,
            'basetimestamp': lr.basetimestamp,
            'starttimestamp': lr.curtimestamp,
            'token': token
        };
        ts = await lib.editPage(params);

    };

    const pages = ['Template:投稿ブロック依頼', 'Wikipedia:投稿ブロック依頼'];
    for (let i = 0; i < pages.length; i++) {
        const linktype = i === 0 ? ['current', 'next'] : ['last', 'current'];
        await updateLinks(pages[i], linktype);
    }
    if (d.next.month !== 1) return ts !== edittedTs ? ts : undefined;

    const createNewAnnualSubpage = async () => {

        const pagetitle = `Wikipedia:投稿ブロック依頼 ${d.next.year}年`;
        console.log(`Creating ${pagetitle}...`);
        if (ts) await lib.dynamicDelay(ts);
        const lr = lib.getLatestRevision(pagetitle);
        if (lr) return console.log(`Cancelled: ${pagetitle} already exists.`);
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
            'action': 'edit',
            'title': pagetitle,
            'text': content,
            'summary': 'Bot: 年次更新処理',
            'bot': true,
            'token': token
        };
        ts = await lib.editPage(params);

    };
    await createNewAnnualSubpage();

    const updateArchiveTemplte = async () => {

        const pagetitle = 'Template:投稿ブロック依頼過去ログ';
        console.log(`Updating links on ${pagetitle}...`);
        if (ts) await lib.dynamicDelay(ts);
        const lr = await lib.getLatestRevision(pagetitle);
        if (!lr) return console.error('Failed to get the lastest revision of ' + pagetitle);

        var content = JSON.parse(JSON.stringify(lr.content));
        const getAnnualLink = y => `[[Wikipedia:投稿ブロック依頼 ${y}年|${y}年]]`;
        const lkOldYear = getAnnualLink(d.current.year),
              lkNewYear = getAnnualLink(d.next.year);
        if (content.indexOf(lkNewYear) !== -1) return console.log('Cancelled: Links have already been updated.');
        content = content.replace(lkOldYear, lkOldYear + ' - ' + lkNewYear);

        const params = {
            'action': 'edit',
            'title': pagetitle,
            'text': content,
            'summary': 'Bot: 年次更新処理',
            'bot': true,
            'minor': true,
            'basetimestamp': lr.basetimestamp,
            'starttimestamp': lr.curtimestamp,
            'token': token
        };
        ts = await lib.editPage(params);

    };
    await updateArchiveTemplte();

    return ts !== edittedTs ? ts : undefined;

}
module.exports.updateRFB = updateRFB;