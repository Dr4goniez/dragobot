/********************** DEPENDENCIES **********************/

const my = require('./my');
const MWBot = require('mwbot');
const api = new MWBot({
    apiUrl: my.apiUrl
});
const lib = require('./lib');

console.log('The bot started running.');

/********************** SCRIPT BODY **********************/

(async () => { // Just a wrapper function

/********************** STARTUP FUNCTION **********************/

// Login
const token = await api.loginGetEditToken({
    username: my.username,
    password: my.password
}).then(res => {
    if (!res) return console.log('An unexpected error occurred on login attempt.');
    return res.csrftoken;
}).catch((err) => console.log(err.login.reason));

if (!token) return;

var categoryMembers = await getCategoryMembers('Category:構文ハイライトエラーがあるページ');
if (!categoryMembers) return console.log('Failed to get category members.');
if (categoryMembers.length === 0) return console.log('No page is in this category.');
categoryMembers = categoryMembers.filter(page => !page.match(/^利用者:/));

var edited = false;
for (const page of categoryMembers) {

    if (edited) await lib.delay(5*1000);
    edited = false;

    const parsed = await lib.getLatestRevision(page);
    if (!parsed) {
        console.log(page + ': Failed to parse the page.');
        continue;
    }
 
    let content = parsed.content;
    const len = JSON.parse(JSON.stringify(content)).length;
    if (content.indexOf('<syntaxhighlight') !== -1 || content.indexOf('<source') !== -1) {

        content = content.replaceAll('<syntaxhighlight>', '<syntaxhighlight lang="text">').replaceAll('<source>', '<source lang="text">');
        content = content.replaceAll('<syntaxhighlight lang="mion"', '<syntaxhighlight lang="text"').replaceAll('<source lang="mion"', '<source lang="text"');
        content = content.replaceAll('<syntaxhighlight lang="syntaxhighlight">', '<syntaxhighlight lang="text">').replaceAll('<source lang="syntaxhighlight">', '<source lang="text">');
        content = content.replaceAll('<syntaxhighlight language', '<syntaxhighlight lang').replaceAll('<source language', '<source lang');
        content = content.replaceAll('<syntaxhighlight code', '<syntaxhighlight lang').replaceAll('<source code', '<source lang');

        if (content.length === len) {
            console.log(page + ': Cancelled.');
            continue;
        }

        const result = await api.request({
            'action': 'edit',
            'title': page,
            'text': content,
            'summary': 'Bot: [[Category:構文ハイライトエラーがあるページ]]',
            'minor': true,
            'bot': true,
            'basetimestamp': parsed.basetimestamp,
            'starttimestamp': parsed.curtimestamp,
            'watchlist': 'nochange',
            'token': token
        }).then(res => {
            if (res && res.edit) {
                if (res.edit.result === 'Success') return true;
            }
            return false;
        }).catch((err) =>err);
 
        switch(result) {
            case true:
                edited = true;
                console.log(page + ': ' + (content.length - len));
                break;
            case false:
                console.log(page + ': An unexpected error occurred on edit attempt.');
                break;
            default:
                console.log(page + ': ' + result);
        }

    } else {
        console.log(page + ': Skipped.');
    }

}

/********************** MAIN FUNCTIONS **********************/

function getCategoryMembers(category) {
    return new Promise(resolve => {
        api.request({
            'action': 'query',
            'list': 'categorymembers',
            'cmtitle': category,
            'cmprop': 'title',
            'cmlimit': 'max',
            'formatversion': 2
        }).then(res => {
            var resCat;
            if (!res || !res.query) return resolve();
            if ((resCat = res.query.categorymembers).length === 0) return resolve([]);
            var catMembers = resCat.map(obj => obj.title);
            resolve(catMembers);
        }).catch(err => resolve(console.log(err.error.info)));
    });
}

/********************************************/

})();