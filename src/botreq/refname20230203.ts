import { createServer } from '../server';
import { init, getMw } from '../mw';
import * as lib from '../lib';
import { ApiParamsEditPage, ApiResponse, ApiResponseError, ApiResponseQueryListSearch } from '..';

const testrun = true;
createServer(testrun);
init().then(async (mw) => {
	if (!mw) return;

	const titles = await searchText();
	if (!titles) return;
	console.log(titles.length);
	// const titles = ['利用者:DragoTest/test'];

	const editPage = async (pagetitle: string) => {

		const lr = await lib.getLatestRevision(pagetitle);
		if (!lr) return;
		const content = lr.content;
		const newContent = lib.replaceWikitext(content, [/［[^\S\r\n]*ref name[^\S\r\n]*[:：][^\S\r\n]*[^］]+］/], '');
		if (content === newContent) {
			console.log('Same content.');
			return;
		}

		const editParams: ApiParamsEditPage = {
			title: pagetitle,
			text: newContent,
			summary: '[[Special:PermaLink/93694771#［ref_name_%3A_○○］という記法の除去|WP:BOTREQ#［ref_name_%3A_○○］という記法の除去]]',
			bot: true,
			basetimestamp: lr.basetimestamp,
			starttimestamp: lr.curtimestamp,
		};
		await lib.edit(editParams);
		return true;

	};

	let edited = 0;
	for (const title of titles) {
		const result = await editPage(title);
		if (result) edited++;
	}
	console.log(`Done: Edited ${edited} pages.`);

});

function searchText(): Promise<undefined|string[]> {
	const mw = getMw();
	return new Promise(resolve => {
		mw.request({
			action: 'query',
			list: 'search',
			srsearch: 'insource: /［ *ref name/',
			srnamespace: 0,
			srlimit: 'max',
			srwhat: 'text',
			formatversion: '2'
		}).then((res: ApiResponse) => {
			let resSr: ApiResponseQueryListSearch[] | undefined;
			if (!res || !res.query || !(resSr = res.query.search)) {
				return resolve(undefined);
			} else {
				const titles = resSr
					.filter(obj => obj.title)
					.map(obj => obj.title);
				resolve(titles);
			}
		}).catch((err: ApiResponseError) => {
			console.log(err.info);
			resolve(undefined);
		});
	});
}