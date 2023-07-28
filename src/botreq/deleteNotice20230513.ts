import { createServer } from '../server';
import { init } from '../mw';
import * as lib from '../lib';
import { ApiResponse, ApiResponseError, ApiResponseQueryListLogevents, ApiResponseQueryListUsercontribs } from '..';

const testrun = true;
createServer(testrun);
init(2).then(async (mw) => {

    if (!mw) return;

    const getPages = (): Promise<string[]> => {
        return mw.request({
            action: 'query',
            list: 'logevents',
            leaction: 'delete/delete',
            leend: '2023-05-11T02:49:24Z',
            lenamespace: '14',
            lelimit: 'max',
            formatversion: '2'
        }).then(function(res: ApiResponse) {
            let resLgev: ApiResponseQueryListLogevents[]|undefined;
            if (!res || !res.query || !(resLgev = res.query.logevents)) return [];
            return resLgev.reduce((acc: string[], {title, user}) => {
                if (user && title && ['Dragoniez', '柏尾菓子'].includes(user) && /国家・領域$/.test(title)) {
                    const cattalk = 'Category‐ノート:' + title.split(':')[1];
                    if (!acc.includes(cattalk)) {
                        acc.push(cattalk);
                    }
                }
                return acc;
            }, []);
        }).catch(function(err: ApiResponseError) {
            console.log(err);
            return [];
        });
    };

    const getUc = (): Promise<string[]|void> => {
        return mw.request({
            action: 'query',
            list: 'usercontribs',
            ucend: '2023-05-12T11:09:45Z',
            ucuser: '柏尾菓子',
            ucnamespace: '15',
            uclimit: 'max',
            formatversion: '2'
        }).then((res: ApiResponse) => {
            let resUc: ApiResponseQueryListUsercontribs[]|undefined;
            if (!res || !res.query || !(resUc = res.query.usercontribs)) return;
            return resUc.reduce((acc: string[], {title}) => {
                if (/国家・領域$/.test(title) && !acc.includes(title)) {
                    acc.push(title);
                }
                return acc;
            }, []);
        }).catch((err: ApiResponseError) => {
            console.log(err);
        });
    };

    let catTalks = await getPages();
    const pasted = await getUc();
    if (!pasted) return;
    catTalks = catTalks.filter(p => !pasted.includes(p));

    const urls: string[] = [];
    const templ = '{{subst:削除済みノート|Category:各年に消滅した国家・領域およびCategory:各年に成立した国家・領域の下にある各カテゴリ}}';
    for (const page of catTalks) {

        const lr = await lib.getLatestRevision(page);
        if (lr !== false) {
            urls.push('https://ja.wikipedia.org/wiki/' + page);
            continue;
        }

        const params = {
            title: page,
            text: templ,
            summary: 'Bot: ' + templ,
            minor: true,
            bot: true
        };
        const result = await lib.edit(params);
        if (!result) {
            urls.push('https://ja.wikipedia.org/wiki/' + page);
        }

    }

    urls.forEach((url) => {
        console.log(url);
    });

});