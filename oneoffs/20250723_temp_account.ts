/**
 * Replaces `"臨時アカウント"` with `"仮アカウント"`, and `"臨時利用者"` with `"仮利用者"`
 * on translatewiki.
 *
 * npx ts-node oneoffs/20250723_temp_account.ts
 */
import { init } from '../src/mwbot';
import { MwbotError, type ApiResponse } from 'mwbot-ts';

interface ExtendedApiResponse extends ApiResponse {
	search: ApiResponseSearchtranslations;
}

interface ApiResponseSearchtranslations {
	metadata: {
		total: number;
	};
	translations: ApiResponseSearchtranslationsTranslations[];
}

interface ApiResponseSearchtranslationsTranslations {
	wiki: string;
	uri: string;
	localid: string;
	language: string;
	content: string;
	group: string[];
}

const rContent = /臨時(?:アカウント|利用者)/;
const rContentGlobal = new RegExp(rContent.source, 'g');
const rExclude = /^Translations:(?:User:|Tech\/News\/)/;
const DEFAULT_LIMIT = 50;

const siteinfo = {
	translatewiki: {
		id: 'translatewiki_net-bw_',
		api: 'https://translatewiki.net/w/api.php'
	},
	foundationwiki: {
		id: 'foundationwiki',
		api: 'https://foundation.wikimedia.org/w/api.php'
	},
	mediawikiwiki: {
		id: 'mediawikiwiki',
		api: 'https://www.mediawiki.org/w/api.php'
	},
	metawiki: {
		id: 'metawiki',
		api: 'https://meta.wikimedia.org/w/api.php'
	}
};

/**
 * The `action=searchtranslations` API returns translations from multiple wikis.
 * Each translation object includes a `wiki` field indicating which wiki it belongs to,
 * using the wiki's internal ID (e.g., "foundationwiki", "metawiki").
 */
const DB: keyof typeof siteinfo = 'metawiki';

init('dragoniez', siteinfo[DB].api).then(async (mwbot) => {

	const pages = new Set<string>();
	const searchResult = await (function continuedSearch(offset: number): Promise<boolean> {
		return mwbot.get({
			action: 'searchtranslations',
			query: '臨時',
			sourcelanguage: 'ja',
			language: 'ja',
			limit: 'max',
			offset,
			formatversion: '2'
		}).then((response) => {
			const { search, limits } = response as ExtendedApiResponse;
			search.translations.forEach(({ wiki, localid, language, content }) => {
				if (wiki === siteinfo[DB].id && language === 'ja' && rContent.test(content) && !rExclude.test(localid)) {
					pages.add(`${localid}/${language}`);
				}
			});
			offset += (limits?.searchtranslations as number | undefined) ?? DEFAULT_LIMIT;
			if (search.metadata.total > offset) {
				return continuedSearch(offset);
			}
			return true;
		}).catch((err) => {
			console.log(err);
			return false;
		});
	})(0);
	// console.log(pages);
	if (!searchResult) {
		console.log('Search failed.');
		return;
	}

	const failed = new Set<string>();
	let aborted = 0;
	const summaryParts = {
		accountReplaced: '臨時アカウント → 仮アカウント',
		userReplaced: '臨時利用者 → 仮利用者',
		discussion: ' (see [[:mw:Special:Permalink/7751080#Translation_of_.27temporary.27_in_Japanese|discussion]])'
	};

	for (const page of pages) {
		console.log(`Editing ${page}...`);

		const res = await mwbot.edit(page, (wikitext) => {
			const original = wikitext.content;
			let accountReplaced = false;
			let userReplaced = false;

			const newContent = original.replace(rContentGlobal, (match) => {
				switch (match) {
					case '臨時アカウント':
						accountReplaced = true;
						return '仮アカウント';
					case '臨時利用者':
						userReplaced = true;
						return '仮利用者';
					default: return match;
				}
			});

			if (original === newContent) return null;

			const summary: string[] = [];
			if (accountReplaced) {
				summary.push(summaryParts.accountReplaced);
			}
			if (userReplaced) {
				summary.push(summaryParts.userReplaced);
			}

			return {
				text: newContent,
				summary: summary.join(', ') + summaryParts.discussion,
				watchlist: 'watch'
			};
		}).catch((err: MwbotError) => err);

		if (res instanceof MwbotError) {
			if (res.code !== 'aborted') {
				console.log(res);
				console.log('Edit failed.');
				failed.add(page);
			} else {
				console.log('Edit aborted.');
				aborted++;
			}
		} else {
			console.log('Edit complete.');
		}
	}

	console.log('All edits complete.');
	console.group();
	console.log(`Success: ${pages.size - failed.size - aborted}`);
	console.log(`Failure: ${failed.size}`);
	console.log(`Aborted: ${aborted}`);
	if (failed.size) {
		console.log(Array.from(failed));
	}
	console.groupEnd();

}).catch(console.error);