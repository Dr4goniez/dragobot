/* eslint-disable @typescript-eslint/ban-ts-comment */
import { createServer, log } from './server';
import { init, getMw } from './mw';
import * as lib from './lib';
import {
	ApiResponse,
	ApiResponseError,
	ApiResponseQueryListSearch,
	ApiResponseQueryPages
} from '.';
import { Title, getNsIdsByType } from './title';
import {decode} from 'html-entities';


const testrun = true; // Must be configured
createServer(testrun);
const useTestAccount = false; // Must be configured
let processed: string[] = [];
init(useTestAccount ? 3 : 2).then(async (mw) => {
	if (!mw) return;
	// const debugTitles: string[] = [
	// 	// '利用者:DragoTest/test/delnote1',
	// 	// '利用者:DragoTest/test/delnote2',
	// 	// '利用者:DragoTest/test/delnote3',
	// ];
	// // const limit = 10;
	// const limit = 4999; // Default
	// const lr = await lib.getLatestRevision('利用者:DrakoBot/botreq_削除依頼ログ');
	// if (!lr) return;
	// const regex = /\[\[(.+?)\]\]/g
	// let m;
	// while ((m = regex.exec(lr.content))) {
	// 	processed.push(m[1]);
	// }
	// runBot(debugTitles.length ? debugTitles : null, limit);

	runBotMax();

});


const talkNsNum: number[] = getNsIdsByType('talk').filter(num => num !== 3);

async function runBotMax() {

	const lr = await lib.getLatestRevision('利用者:DrakoBot/botreq_削除依頼ログ');
	if (!lr) return;
	const oldLogContent = lr.content;

	/** 1: {{レ}}, 2: pagetitle, 3: error code */
	const regex = /\*[^\S\r\n]*(\{\{レ\}\})[^\S\r\n]*\[\[(.+?)\]\]([^\n]+)\n?/g;
	type Lines = {[title: string]: string[];};
	const lines: Lines = {};
	let m;
	while ((m = regex.exec(oldLogContent))) {
		const row = m[0];
		const ignore = !!m[1];
		const title = m[2];
		if (ignore && !processed.includes(title)) {
			processed.push(title);
		}
		if (lines[title]) {
			lines[title].push(row);
		} else {
			lines[title] = [row];
		}
	}

	// Get pages to edit
	const pages = await collectPages(5000);
	if (!pages) {
		return;
	} else if (!pages.length) {
		log('All pages have been processed.');
		return;
	}

	// Process the collected pages
	const getErrorLine = (title: string, codes: string[]) => {
		return `* [[${title}]] - ${codes.join(', ')}`;
	};
	for (const p of pages) {
		const afd = new AFDNote(p);
		console.log(`Checking ${p}...`);
		await afd.init();
		if (afd.errCodes.length && lines[p]) { // Error on this run and on an older run
			delete lines[p];
			lines[p] = [getErrorLine(p, afd.errCodes)]; // Send the line to bottom
		} else if (!afd.errCodes.length && lines[p]) { // No error on this run and one on an older run
			delete lines[p];
		} else if (afd.errCodes.length && !lines[p]) {
			lines[p] = [getErrorLine(p, afd.errCodes)];
		} else {
			// Do nothing
		}
	}

	// Leave error log
	const errors = Object.keys(lines).reduce((acc: string[], title) => {
		const arr = lines[title];
		acc.push(arr[0].trim());
		return acc;
	}, []);
	const newLogContent = errors.join('\n');
	if (errors.length) {
		let res: boolean|null = false;
		let tried = 0;
		while (!res && tried < 5) {
			tried++;
			res = await lib.edit({
				title: '利用者:DrakoBot/botreq_削除依頼ログ',
				text: newLogContent,
				summary: 'log',
				bot: true
			}, isIntervalNeeded());
			if (!res) {
				await lib.sleep(1000*10);
			}
		}
	}

	// Update diff
	await updateDiff(oldLogContent, newLogContent);

}

/** Run the bot. */
async function runBot(testTitles: string[]|null, limit: number) {

	// Get pages to edit
	const pages = testTitles || await collectPages(limit);
	if (!pages) {
		return;
	} else if (!pages.length) {
		log('All pages have been processed.');
		return;
	}

	// Edit page
	const errors: string[] = []; // *{{PAGE|TITLE}} - error code
	for (const p of pages) {
		const afd = new AFDNote(p);
		await afd.init();
		if (afd.errCodes.length) {
			errors.push(`* [[${p}]] - ${afd.errCodes.join(', ')}`);
		}
	}

	// Leave error log
	if (errors.length) {
		let res: boolean|null = false;
		let tried = 0;
		while (!res && tried < 5) {
			tried++;
			res = await lib.edit({
				title: '利用者:DrakoBot/botreq 削除依頼ログ',
				appendtext: '\n' + errors.join('\n'),
				summary: 'log',
				bot: true
			}, isIntervalNeeded());
			if (!res) {
				await lib.sleep(1000*10);
			}
		}
	}

	// Next
	if (!testTitles && limit === 4999) {
		runBot(null, limit);
	}

}

let searchDone = false;
let runCnt = 0;
/**
 * Collect pages to run the bot on. First search for pages that have subst-ed AfD notes, and when all these pages have been processed
 * search for pages that transclude Template:削除依頼過去ログ.
 * @returns Null if search failed, or else an array of pages.
 */
async function collectPages(limit: number): Promise<string[]|null> {

	if (searchDone) {
		return [];
	}

	const mw = getMw();
	runCnt++;
	let offset = limit * (runCnt - 1);
	if (offset >= 10000) {
		runCnt = 1;
		offset = limit * (runCnt - 1);
	}

	const search = (): Promise<string[]|null> => {
		return mw.request({
			action: 'query',
			list: 'search',
			srsearch: 'insource:/この((ノート)?ページ(は.[度回]|には)|記事に?は(.[度回])?)(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除)/',
			// srsearch: 'insource:/この(ページ|記事|ノート|ノートページ)に?は(?:.[度回])?(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除)/',
			srnamespace: talkNsNum.join('|'),
			srprop: '',
			srlimit: limit ? limit.toString() : 'max',
			sroffset: offset,
			formatversion: '2'
		}).then((res: ApiResponse) => {
			let resSrch: ApiResponseQueryListSearch[]|undefined;
			if (!res || !res.query || !(resSrch = res.query.search)) {
				log('Query failed.');
				return null;
			}
			return resSrch.reduce((acc: string[], {title}) => {
				if (!processed.includes(title)) {
					processed.push(title);
					acc.push(title);
				}
				return acc;
			}, []);
		}).catch((err: ApiResponseError) => {
			if (err && err.info) {
				log(err.info);
			} else {
				log('Query failed.');
			}
			return null;
		});
	};

	let titles: string[]|null = null;
	if (!searchDone) {
		log('Searching for pages...');
		for (let i = 0; i < 3; i++) {
			titles = await search();
			if (titles) {
				break;
			} else if (i < 2) {
				log('Retrying in 10 seconds...');
				await lib.sleep(1000*10);
			}
		}
		if (!titles) {
			log('Search failed.');
			return null;
		} else if (titles.length) {
			log(`${titles.length} pages found.`);
			return titles;
		} else {
			log('No pages matched the search criteria.');
			searchDone = true;
		}
	}
	// log('Fetching pages that transclude Template:削除依頼過去ログ...');
	// titles = await lib.getEmbeddedIn('Template:削除依頼過去ログ', {einamespace: talkNsNum.join('|')});
	// if (!titles) {
	// 	log('getEmbeddedIn returned null.');
	// 	return [];
	// }
	// titles = titles.filter(el => !processed.includes(el));
	// log(`${titles.length} page(s) found.`);
	// processed = processed.concat(titles);
	return titles;

}

interface ParsedDeletionNote {
	input: string|RegExp;
	notes: DeletionNoteInfo[];
}
interface DeletionNoteInfo {
	talk: boolean;
	result: string;
	subpage: string;
}
interface ParsedLinks {
	titles: string[];
	hasDelPage: boolean;
}
type ErrorCodes = (
	/** Failed to get the latest revision or the page doesn't exist. */
	|'nolr'
	/** No deletion notes have been parsed. */
	|'unparsed'
	/** Detected an unparsable $1 in [[$1|$2]]. */
	|'unparsablelinks'
	/** Detected an unparsable Template:削除依頼ログ. */
	|'unparsableafdlog'
	/** A log line returned no wikilinks after parseLinks(). */
	|'logline'
	/** Detected an occurrence of Template:削除依頼過去ログ that can't be processed because the page type (main, talk) is unknown. */
	|'pagetypeunknown'
	/** Detected an occurrence of Template:削除依頼過去ログ that has a logline with an unprocessable AfD result. */
	|'resultunknown'
	/** Detected an occurrence of Template:削除依頼過去ログ that has a logline with no parsable links. */
	|'noparsablelinks'
	/** Newly appended templates might have links to non-existing pages. */
	|'existenceunknown'
	/** Code error on page existence. */
	|'existenceundefined'
	/** createTemplate() returned empty arrays. */
	|'emptytemplate'
	/** The page content is the same before and after running the bot. */
	|'samecontent'
	/** Failed to edit the page. */
	|'editfailed'
);

class AFDNote {

	Title: Title;
	delTitle: Title;
	hasDelPage: {
		main: boolean;
		talk: boolean;
	};
	content: string;
	errCodes: ErrorCodes[];

	constructor(pagetitle: string) {
		this.Title = new Title(pagetitle);
		this.delTitle = new Title(this.Title.toString().split('/')[0] + '/削除');
		this.hasDelPage = {
			main: false,
			talk: false
		};
		this.content = '';
		this.errCodes = [];
	}

	private addCode(code: ErrorCodes) {
		if (!this.errCodes.includes(code)) {
			this.errCodes.push(code);
		}
	}

	async init() {

		// Get latest revision
		const prefixedTitle = this.Title.toString();
		const lr = await lib.getLatestRevision(prefixedTitle);
		if (!lr) {
			this.addCode('nolr');
			return;
		}
		this.content = lr.content;

		const parsed = this.parseDeletionNotes().concat(this.parseAfdOldLog(), this.parseAfdLog());
		if (!parsed.length) {
			this.addCode('unparsed');
			return;
		}
		this.content = lib.replaceWikitext(this.content, parsed.map(({input}) => input), '');
		parsed.forEach(({input}) => {
			// lib.replaceWikitext first replaces all comment tags with a temporary string and get them back when the replacement is done.
			// This means that when the replacee string itself has a comment tag in it, that won't be replaced.
			if (typeof input === 'string' && input.includes('<!--')) {
				this.content = this.content.replace(input, '');
			}
		});

		const tmpl = await this.createTemplate(parsed);
		if (!tmpl.length) {
			this.addCode('emptytemplate');
			return;
		} else {
			this.content = tmpl.join('\n') + '\n' + this.content;
		}

		if (this.content === lr.content) {
			this.addCode('samecontent');
			return;
		}

		// Edit the page
		const res = await lib.edit({
			title: prefixedTitle,
			text: this.content,
			summary: '[[Special:PermaLink/96298914#削除済みノートをテンプレートへ置換|WP:BOTREQ#削除済みノートをテンプレートへ置換]]',
			bot: true,
			basetimestamp: lr.basetimestamp,
			starttimestamp: lr.curtimestamp,
		}, isIntervalNeeded());
		if (!res) {
			this.addCode('editfailed');
		}

	}

	private parseDeletionNotes(): ParsedDeletionNote[] {

		/** 1: Whether the note is for a talk page; 2: Result of AfD; 3: Redundant comments */
		const regex = /(?:\{\{NOINDEX\}\}\s*)?\**[^\S\n\r]*[^\S\n\r]*'*[^\S\n\r]*この(ページ|記事|ノート|ノートページ)に?は(?:.[度回]|複数回)?(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除).+?をご(?:らん|覧)(?:下|くだ)さい。?([^\n]*)\n*/g;

		// Get all subst-ed 削除済みノート
		const ret: ParsedDeletionNote[] = [];
		let m: RegExpExecArray|null;
		while ((m = regex.exec(this.content))) {

			const logline = m[3] ? m[0].replace(new RegExp(lib.escapeRegExp(m[3]) + '\\n*$'), '') : m[0];

			// Parse all links to an AfD subpage and get subpage titles
			const links = this.parseLinks(logline);
			if (!links.hasDelPage && !links.titles.length) {
				this.addCode('logline');
				continue;
			}

			// Get an unified result of the AfDs
			const talk = m[1] === 'ノート' || m[1] === 'ノートページ';
			const result = AFDNote.getResult(m[2]);
			ret.push({
				input: m[0],
				// If this is an empty array, the input string is just to be replaced with an empty string.
				notes: links.titles.map((subpage) => ({talk, result, subpage}))
			});

			if (links.hasDelPage) {
				const key = talk ? 'talk' : 'main';
				this.hasDelPage[key] = true;
			}

		}

		return ret;

	}

	/** Convert a matched string to an AfD result. */
	private static getResult(matched: string) {
		switch (matched) {
			case '削除':
				return '削除';
			case '特定版削除':
				return '特定版削除';
			case '版指定削除':
			case '特定版版指定削除':
			case '削除された版':
				return '版指定削除';
			case '削除が検討':
				return '存続';
			default:
				return '';
		}
	}

	private static illegalTitleChars = new RegExp('[^ %!"$&\'()*,\\-./0-9:;=?@A-Z\\\\\\^_`a-z~+\\u0080-\\uFFFF]');

	/**
	 * Parse wikilinks in a string, looking only at AfD subpages (and the talk page for AfD discussions).
	 * @param str
	 * @returns An array of AfD subpage , duplicates not handled.
	 */
	private parseLinks(str: string): ParsedLinks {
		const regex = /\[\[(.+?)(?:(?<!\{\{\{\d)\|([^\]]+))?\]\]/g; // [[(1)|(2)]] (ingore '|' in '{{{1|')
		const subpages: string[] = [];
		let m: RegExpExecArray|null;
		let hasDelPage = false;
		while ((m = regex.exec(str))) {
			let p: RegExpMatchArray|null;
			m[1] = decode(m[1])
				.replace(/\{\{[^\S\r\n]*NAMESPACE[^\S\r\n]*\}\}/g, this.Title.getNamespacePrefix().replace(/:$/, ''))
				.replace(/\{\{[^\S\r\n]*PAGENAME[^\S\r\n]*\}\}/g, this.Title.getMain())
				.replace(/\{\{\{[^\S\r\n]*\d+[^\S\r\n]*\|[^\S\r\n]*(.+?)[^\S\r\n]*\}\}\}/g, '$1')
				.replace(/_/g, ' ');
			if ((p = m[1].match(/^\s*:?\s*(?:wikipedia|wp|project)\s*:\s*削除依頼\/(.+?)\s*$/i)) && !AFDNote.illegalTitleChars.test(p[1])) {
				const page = p[1].replace(/_/g, ' ');
				subpages.push(page);
			} else if (!hasDelPage && this.delTitle.equals(m[1])) {
				hasDelPage = true;
			} else {
				this.addCode('unparsablelinks');
				continue;
			}
		}
		return {
			titles: subpages,
			hasDelPage
		};
	}

	/** Parse Template:削除依頼過去ログ in the content. */
	private parseAfdOldLog(): ParsedDeletionNote[] {

		// Does the content have any 削除依頼過去ログ template in it?
		const tmpl = lib.parseTemplates(this.content, {namePredicate: name => name === '削除依頼過去ログ'});
		return tmpl.reduce((acc: ParsedDeletionNote[], obj) => {

			if (obj.arguments.length) {

				let forTalk = false;
				for (const arg of obj.arguments) {
					if (arg.name === 'type') {
						switch (arg.value) {
							case '記事':
							case '':
								forTalk = false;
								break;
							case 'ノート':
								forTalk = true;
								break;
							default:
								this.addCode('pagetypeunknown');
								return acc; // Type unknown, unprocessable
						}
						break;
					}
				}

				const info: DeletionNoteInfo[] = [];
				for (const arg of obj.arguments) { // Look at all arguments of the template
					if (['list', 'oldlist'].includes(arg.name)) { // list= or oldlist= have AfD logs
						const logs = arg.value.split(/\n?\*/).filter(el => el && el.trim()); // e.g. * '''削除''' [[Wikipedia:削除依頼/X]]
						for (const logline of logs) {
							const rm = logline.match(/'''(.+?)'''/);
							if (!rm) {
								this.addCode('resultunknown');
								return acc; // Result unknown, unprocessable
							}
							const result = rm[1].trim();
							const links = this.parseLinks(logline);
							if (links.titles.length) {
								if (links.hasDelPage) {
									const key = forTalk ? 'talk' : 'main';
									this.hasDelPage[key] = true;
								}
								links.titles.forEach((p) => {
									info.push({
										talk: forTalk,
										result,
										subpage: p
									});
								});
							} else {
								if (links.hasDelPage) {
									const key = forTalk ? 'talk' : 'main';
									this.hasDelPage[key] = true;
								} else {
									this.addCode('noparsablelinks');
									return acc; // No parsable links, unprocessable
								}
							}

						}
					}
				}

				acc.push({
					input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
					notes: info
				});

			} else { // The template has no parameter; Just to be replaced with an empty string
				acc.push({
					input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
					notes: []
				});
			}
			return acc;

		}, []);

	}

	/** Parse existing Template:削除依頼ログ in the content. */
	private parseAfdLog(): ParsedDeletionNote[] {

		// Does the content have any 削除依頼ログ template in it?
		const tmpl = lib.parseTemplates(this.content, {namePredicate: name => name === '削除依頼ログ'});
		return tmpl.reduce((acc: ParsedDeletionNote[], obj) => {
			if (obj.arguments.length) {

				const forTalk = obj.arguments.some(({name, value}) => name === 'talk' && value === 'true');
				const info: DeletionNoteInfo[] = [];
				obj.arguments.some(({name, value}) => {
					if (value === '特定版指定削除') {
						value = '特定版削除';
					}
					let m;
					if ((m = /^(\D+)(\d+)$/.exec(name))) {
						const key = m[1];
						const num = parseInt(m[2]) - 1;
						switch (key) {
							case 'result':
								if (info[num]) {
									info[num].result = value;
								} else {
									info[num] = {
										talk: forTalk,
										result: value,
										subpage: ''
									};
								}
								return false;
							case 'page':
								if (info[num]) {
									info[num].subpage = value;
								} else {
									info[num] = {
										talk: forTalk,
										result: '',
										subpage: value
									};
								}
								return false;
							case 'date':
								return false;
							default:
								return true;
						}
					}
				});
				const filteredInfo = info.filter(({result, subpage}) => result.trim() && subpage.trim());
				if (filteredInfo.length && filteredInfo.length === info.length) {
					acc.push({
						input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
						notes: filteredInfo
					});
				} else {
					this.addCode('unparsableafdlog');
				}
			}
			return acc;
		}, []);

	}

	private async createTemplate(parsed: ParsedDeletionNote[]): Promise<string[]> {

		// Flatten the 'parsed' array of objects to an array of 'notes' object array without duplicates
		const pages: string[] = [];
		const notes = parsed.reduce((acc: DeletionNoteInfo[], obj) => {
			obj.notes.forEach((nObj) => {
				const subpage = `Wikipedia:削除依頼/${nObj.subpage}`;
				if (!pages.includes(subpage)) {
					pages.push(subpage);
				}
				acc.push(nObj);
			});
			return acc;
		}, []);

		// Check page existence
		const delPrefixedTitle = this.delTitle.getPrefixedText();
		if (this.hasDelPage.main || this.hasDelPage.talk) {
			pages.push(delPrefixedTitle);
		}
		const e = await pagesExist(pages);
		notes.sort((obj1, obj2) => {
			const ts1 = e[`Wikipedia:削除依頼/${obj1.subpage}`].create;
			const ts2 = e[`Wikipedia:削除依頼/${obj2.subpage}`].create;
			if (!ts1 || !ts2) {
				return ts1 > ts2 ? 1 : -1;
			} else {
				const d1 = new Date(ts1);
				const d2 = new Date(ts2);
				return d1 > d2 ? 1 : -1;
			}
		});

		// Create templates
		type TemplateInfo = {
			params: string[];
			added: string[];
		}
		type Template = {
			main :TemplateInfo;
			talk: TemplateInfo;
		}
		let tmpl: Template = {main: {params: [], added: []}, talk: {params: [], added: []}};
		if (this.hasDelPage.main && e[delPrefixedTitle].exist) {
			tmpl.main.params.push(`|result1=ノート議論|fullpage1=${delPrefixedTitle}`);
		}
		if (this.hasDelPage.talk && e[delPrefixedTitle].exist) {
			tmpl.talk.params.push(`|result1=ノート議論|fullpage1=${delPrefixedTitle}`);
		}
		tmpl = notes.reduce((acc: Template, {talk, result, subpage}) => {

			const page = `Wikipedia:削除依頼/${subpage}`;
			const typ = talk ? 'talk' : 'main';
			const params = tmpl[typ].params;
			const added = tmpl[typ].added;
			if (added.includes(page)) {
				return acc;
			} else {
				added.push(page);
			}
			switch (e[page].exist) {
				case true: // Page exists
					break;
				case false: // Page doesn't exist
					return acc;
				case null: // Existence unknown
					log(`Existence unknown for ${page}`);
					this.addCode('existenceunknown');
					break;
				case undefined:
					log(`Existence undefined for ${page}`);
					this.addCode('existenceundefined');
					return acc;
			}

			const i = params.length + 1;
			const dm = e[page].create.match(/^(\d{4})-(\d{2})-(\d{2})/);
			let d = '';
			if (dm) {
				d = `${dm[1]}年${dm[2].replace(/^0/, '')}月${dm[3].replace(/^0/, '')}日`;
			}
			params.push(`|result${i}=${result}|page${i}=${subpage}|date${i}=${d}`);

			return acc;

		}, tmpl);

		return ['main', 'talk'].reduce((acc: string[], key) => {
			// @ts-ignore
			const params = tmpl[key].params;
			if (params.length) {
				params.unshift('{{削除依頼ログ', `|talk=${key === 'talk'}`);
				params.push('}}');
				acc.push(params.join('\n'));
			}
			return acc;
		}, []);

	}

}

interface ExistObject {
	[title: string]: {
		/** Whether the title exists. Null if the query failed. */
		exist: boolean|null;
		/** The timestamp of the first revision. An empty string if it's unavailable. */
		create: string;
	};
}

async function pagesExist(pagetitles: string[]): Promise<ExistObject> {

	const params = {
		action: 'query',
		titles: pagetitles,
		prop: 'revisions',
		rvprop: 'timestamp',
		rvlimit: 1,
		rvdir: 'newer',
		formatversion: '2'
	};
	const result = await lib.massRequest(params, 'titles', 1);
	return result.reduce((acc: ExistObject, res, i) => {
		let resPg: ApiResponseQueryPages[]|undefined;
		if (res && res.query && (resPg = res.query.pages) && resPg[0]) {
			const resRv = resPg[0].revisions;
			acc[pagetitles[i]] = {
				exist: !resPg[0].missing,
				create: resRv && resRv[0] && resRv[0].timestamp || ''
			};
		} else {
			acc[pagetitles[i]] = {
				exist: null,
				create: ''
			};
		}
		return acc;
	}, Object.create(null));

}

/** August 2023 */
function isIntervalNeeded(): boolean {
	const d = new Date();
	if (!testrun) {
		d.setHours(d.getHours() + 9); // JST: Needed only on Toolforge server
	}
	// log(`JST: ${d}`);
	// log(`Day: ${d.getDay()}`);
	// log(`Date: ${d.getDate()}`);
	// log(`Hour: ${d.getHours()}`);
	const isWeekday = ![0, 6].includes(d.getDay());
	const isHoliday = d.getDate() === 11;
	const hour = d.getHours();
	if (isWeekday && !isHoliday) { // weekday 19-23
		return 19 <= hour && hour < 23;
	} else { // weekend or holiday 9-23
		return 9 <= hour && hour < 23;
	}
}

/**
 * Update 利用者:DrakoBot/botreq 削除依頼ログ.json.
 * @param oldContent
 * @param newContent
 * @returns Whether the edit succeeded.
 */
async function updateDiff(oldContent: string, newContent: string): Promise<boolean> {

	const links = {
		old: parseWikilinks(oldContent),
		new: parseWikilinks(newContent)
	};
	const ret: {added: {[index: number]: string}; removed: {[index: number]: string};} = {
		added: {},
		removed: {}
	};
	links.old.forEach((title) => {
		if (!links.new.includes(title)) {
			ret.removed[Object. keys(ret.removed).length] = title;
		}
	});
	links.new.forEach((title) => {
		if (!links.old.includes(title)) {
			ret.added[Object. keys(ret.added).length] = title;
		}
	});
	const res = await lib.edit({
		title: '利用者:DrakoBot/botreq 削除依頼ログ.json',
		text: JSON.stringify(ret, null, 4),
		summary: 'diff',
		bot: true
	});
	return res || false;

}

/**
 * Simple wikilink parser.
 * @param str Input string
 * @returns An array of pagetitles without duplicates.
 */
function parseWikilinks(str: string) {
	const regex = /\[\[(.+?)\]\]/g;
	let m;
	const ret: string[] = [];
	while ((m = regex.exec(str))) {
		if (!ret.includes(m[1])) {
			ret.push(m[1]);
		}
	}
	return ret;
}