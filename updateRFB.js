/********************** DEPENDENCIES **********************/

const lib = require('./lib');

console.log('The bot started running.');

/********************** SCRIPT BODY **********************/

(async () => { // Just a wrapper function

/********************** STARTUP FUNCTION **********************/

// Login
const token = await lib.getToken();
if (!token) return;

// Get the current month
const d = new Date();
d.setHours(d.getHours() + 9); // JST
const year = d.getFullYear();
const month = d.getMonth() + 1;

// Get the latest revision of the page to create
const pagetitle = `Wikipedia:投稿ブロック依頼 ${year}年${month}月`;
var lr = await lib.getLatestRevision(pagetitle);
if (lr || lr === undefined) return;

// Create the page
var result = await lib.api.request({
    'action': 'edit',
    'title': pagetitle,
    'text': '{{投稿ブロック依頼}}\n== ログ ==\n\n== 依頼 ==',
    'summary': 'Bot: 月次更新処理',
    'bot': true,
    'token': token
}).then(res => {
    if (res && res.edit) {
        if (res.edit.result === 'Success') return true;
    }
    return false;
}).catch((err) => err);

switch (result) {
    case true:
        console.log(pagetitle + ': Edit done.');
        await lib.delay(5*1000);
        break;
    case false:
        return console.log(pagetitle + ': Edit failed due to an unknown error.');
    default:
        return console.log(pagetitle + ': Edit failed: ' + result);
}

// Update template
const templatename = 'Template:投稿ブロック依頼';
lr = await lib.getLatestRevision(templatename);
if (!lr) return console.error('Failed to get the lastest revision of the template.');
var content = JSON.parse(JSON.stringify(lr.content));
var template = lib.findTemplates(content, 'topicpath-sub');
if (template.length === 0) return console.error('The template wasn\'t found.');
template = template[0];
const links = content.match(/\[\[Wikipedia:投稿ブロック依頼 \d{4}年0?(?:[1-9]|[1-9][0-9])月\|\d月\]\]/g);
if (!links) return console.log('Replacee string not found.');
const linkForGivenMonth = (y, m) => {
    const mn = m === 0 ? 12 : m,
          yr = m === 0 ? y - 1 : y;
    return `[[Wikipedia:投稿ブロック依頼 ${yr}年${mn}月|${mn}月]]`;
};
const lastMonth = linkForGivenMonth(year, month - 1),
      thisMonth = linkForGivenMonth(year, month),
      newTemplate = template.replace(lastMonth, lastMonth + ' - ' + (month === 1 ? year + '年 ' : '') + thisMonth);
if (links.includes(thisMonth)) return console.log('The template has already been updated.');
content = content.replace(template, newTemplate);
if (content === lr.content) return console.log(templatename + ': Edit cancelled (same content).');

result = await lib.api.request({
    'action': 'edit',
    'title': templatename,
    'text': content,
    'summary': 'Bot: 月次更新処理',
    'bot': true,
    'minor': true,
    'basetimestamp': lr.basetimestamp,
    'starttimestamp': lr.curtimestamp,
    'token': token
}).then(res => {
    if (res && res.edit) {
        if (res.edit.result === 'Success') return true;
    }
    return false;
}).catch((err) => err);

switch (result) {
    case true:
        console.log(templatename + ': Edit done.');
        break;
    case false:
        return console.log(templatename + ': Edit failed due to an unknown error.');
    default:
        return console.log(templatename + ': Edit failed: ' + result);
}

/********************************************/

})();