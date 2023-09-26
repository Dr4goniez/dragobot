import { createServer } from '../server';
import { init } from '../mw';
import * as lib from './oldlib';
import { ApiParamsEditPage } from '..';

const testrun = true;
createServer(testrun);
init().then(async (mw) => {
	if (!mw) return;

	const titles = await lib.searchText('insource:/trans_(title|chapter)/', [0,1,2]);
	if (!titles) return;
	console.log(titles.length);

	let edited = 0;
	const failed: string[] = [];
	for (const title of titles) {

		const lr = await lib.getLatestRevision(title);
		if (!lr) continue;
		const content = lr.content;

		const templates = lib.parseTemplates(content, {
			parseComments: true,
			templatePredicate: (Template) => {
				const regex = /^Cit(e(web)?|ation)$|^Cite_(book|journal|news|web|press_release|video|report|interview|conference|patent|DVD-notes|music_release_notes|wikisource|Metacritic)$|^Vcite_(book|web)$/;
				return regex.test(Template.name) && /\|(\s*)trans_(title|chapter)/.test(Template.text);
			}
		});
		if (!templates.length) continue;

		let newContent = content;
		templates.forEach(({text}) => {
			newContent = newContent.replace(text, text.replace(/\|(\s*)trans_(title|chapter)/g, '|$1trans-$2'));
		});
		if (newContent === content) continue;

		const params: ApiParamsEditPage = {
			title: title,
			text: newContent,
			summary: '[[Special:PermaLink/94384009#出典テンプレートにおけるtrans_title、trans_chapter引数の名前変更に伴う修正|WP:BOTREQ#出典テンプレートにおけるtrans_title、trans_chapter引数の名前変更に伴う修正]]',
			bot: true,
			minor: true,
			basetimestamp: lr.basetimestamp,
			starttimestamp: lr.curtimestamp,
		};
		const res = await lib.edit(params);
		if (res) {
			edited++;
		} else {
			failed.push(title);
		}

	}
	console.log(edited);
	console.log(failed);

});