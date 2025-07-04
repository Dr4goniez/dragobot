/**
 * This module handles monthly and yearly updates of RFB-related pages,
 * where "RFB" stands for "Requests for Block".
 */

import { MwbotError } from 'mwbot-ts';
import { getMwbot, Util } from './mwbot';

/**
 * Performs monthly/yearly updates of RFB-related pages.
 *
 * This function must be run before the new month starts, because its functionality
 * depends on the calculations of the current month and the next month.
 *
 * @param debuggingMode If `true`, prepend `User:DragoBot/test/` to the
 * titles of pages to be edited. (Default: `false`)
 * @returns
 */
export async function updateRFB(debuggingMode = false): Promise<void> {

	console.log('Starting updates of RFB-related pages...');

	/************************************************************************************
	 * List of pages to update
	 *
	 * Monthly:
	 *   - [[Wikipedia:投稿ブロック依頼 YYYY年MM月]] - Create
	 *   - [[Template:投稿ブロック依頼]] - Update links in {{topicpath-sub}}
	 *   - [[Wikipedia:投稿ブロック依頼]] - Update links in the '依頼' section
	 *
	 * Yearly:
	 *   - [[Wikipedia:投稿ブロック依頼 YYYY年]] - Create
	 *   - [[Template:投稿ブロック依頼過去ログ]] - Update links
	 ************************************************************************************/

	// Get years and months
	let today = new Date();
	if (debuggingMode) {
		// If debugging mode is on, set the current date to December 31, 14:35 UTC this year
		today = new Date(Date.UTC(today.getUTCFullYear(), 11, 31, 14, 35));
	}
	const currentYear = today.getUTCFullYear();
	const currentMonth = today.getUTCMonth() + 1;
	const shiftMonth = (delta: number): DateObject => {
		const date = new Date(Date.UTC(currentYear, currentMonth - 1 + delta));
		return {
			year: date.getUTCFullYear(),
			month: date.getUTCMonth() + 1,
		};
	};
	const dates: DateMap = {
		current: { year: currentYear, month: currentMonth },
		next: shiftMonth(1),
	};

	const funcs = [
		// Monthly updates
		createMonthlySubpage,
		addSubpageLinkToTemplate,
		addSubpageLinkToWikipedia,
		// Yearly updates
		createYearlySubpage,
		updateArchiveTemplate
	];
	for (const request of funcs) {
		if (request === createYearlySubpage && dates.next.month !== 1) {
			return;
		}
		const result = await request(dates, debuggingMode).catch((err: MwbotError) => err);
		if (result instanceof MwbotError) {
			if (result.code !== 'aborted') {
				console.dir(result, { depth: 3 });
				console.log('Edit failed.');
			}
		} else {
			console.log('Edit done.');
			// When WP:RFB is successfully updated, schedule background purge for RFB-related pages
			if (request === addSubpageLinkToWikipedia) {
				purge();
			}
		}
	}

}

interface DateObject {
	/**
	 * A 4-digit UTC year.
	 */
	year: number;
	/**
	 * A UTC month index ranging from 1 to 12.
	 */
	month: number;
}

type DateMap = Record<'current' | 'next', DateObject>;

/**
 * Returns a user page prefix if `debuggingMode` is `true`.
 *
 * @param debuggingMode Whether to use the user test namespace.
 * @returns The page title prefix.
 */
function prefix(debuggingMode: boolean): string {
	return debuggingMode ? 'User:DragoBot/test/' : '';
}

/**
 * Creates `[[Wikipedia:投稿ブロック依頼 YYYY年MM月]]` for the next month.
 *
 * @param dates
 * @param debuggingMode
 * @returns A promise that resolves with the edit result, or rejects if the edit fails.
 *
 * If the page already exists, the edit will fail.
 */
function createMonthlySubpage(dates: DateMap, debuggingMode: boolean) {
	const title = prefix(debuggingMode) + createSubpageTitle(dates.next.year, dates.next.month);
	console.log(`Creating ${title}...`);
	return getMwbot().create(
		title,
		'{{投稿ブロック依頼}}\n== ログ ==\n\n== 依頼 ==',
		'Bot: 月次更新処理'
	);
}

/**
 * Creates a page title like `'Wikipedia:投稿ブロック依頼 YYYY年MM月'`.
 *
 * @param year A four-digit year.
 * @param month Optional month (1–12). If omitted, the `MM月` portion will be excluded.
 * @returns The full page title string.
 */
function createSubpageTitle(year: number, month?: number): string {
	return `Wikipedia:投稿ブロック依頼 ${year}年` + (month ? `${month}月` : '');
}

/**
 * Updates [[Template:投稿ブロック依頼]] by adding a link to the *next* month's RFB subpage
 * (`[[Wikipedia:投稿ブロック依頼 YYYY年MM月|MM月]]`), placed next to the link to the current month.
 *
 * @param dates
 * @param debuggingMode
 * @returns A Promise resolving to a successful edit response or rejecting with an error.
 *
 * If the page does not exist, the edit will fail.
 */
function addSubpageLinkToTemplate(dates: DateMap, debuggingMode: boolean) {

	const mwbot = getMwbot();
	const { next, current } = dates;

	const title = prefix(debuggingMode) + 'Template:投稿ブロック依頼';
	console.log(`Updating ${title}...`);
	return mwbot.edit(title, (wikitext) => {

		// Add a link targeting the next month's subpage
		let linkAdded = false;
		const curLinkTitle = new mwbot.Title(createSubpageTitle(current.year, current.month));
		const yearLabel = next.month === 1 ? `${next.year}年 ` : '';
		const newLink = new mwbot.Wikilink(createSubpageTitle(next.year, next.month), `${next.month}月`);

		const oldContent = wikitext.content;
		const newContent = wikitext.modifyWikilinks((link) => {
			const isCurMonthLink =
				!linkAdded && !link.skip &&
				mwbot.Wikilink.is(link, 'ParsedWikilink') && link.title.equals(curLinkTitle);
			if (isCurMonthLink) {
				linkAdded = true;
				return link.text + ' - ' + yearLabel + newLink.stringify();
			} else {
				return null;
			}
		});

		if (oldContent === newContent) {
			console.log('Edit cancelled: No link found pointing to the current month\'s RFB subpage.');
			return null;
		}
		return {
			text: newContent,
			summary: 'Bot: 月次更新処理',
			minor: true
		};

	});

}

/**
 * Updates [[Wikipedia:投稿ブロック依頼]] by adding a link to the *current* month's RFB subpage
 * (`[[Wikipedia:投稿ブロック依頼 YYYY年MM月|MM月]]`), adjacent to the most recent month's entry.
 *
 * @param dates
 * @param debuggingMode
 * @returns A Promise resolving to a successful edit response or rejecting with an error.
 *
 * If the page does not exist, the edit will fail.
 */
async function addSubpageLinkToWikipedia(dates: DateMap, debuggingMode: boolean) {

	const mwbot = getMwbot();
	const { year, month } = dates.current;

	const title = prefix(debuggingMode) + 'Wikipedia:投稿ブロック依頼';
	console.log(`Updating ${title}...`);
	return mwbot.edit(title, (wikitext) => {

		// Add a link targeting the current month's subpage
		const rPrefixedTitle = /^Wikipedia:投稿ブロック依頼_20\d{2}年(?:1[0-2]|[1-9])月$/;
		const lastIndex = wikitext.parseWikilinks().reduce((acc, link, i) => {
			if (!link.skip && mwbot.Wikilink.is(link, 'ParsedWikilink') && rPrefixedTitle.test(link.title.getPrefixedDb())) {
				acc = i;
			}
			return acc;
		}, -1);

		let newContent;
		const newLink = new mwbot.Wikilink(createSubpageTitle(year, month), `${month}月`);
		if (lastIndex !== -1) {
			const yearLabel = month === 1 ? `${year}年 ` : '';
			newContent = wikitext.modifyWikilinks((link, i) => {
				return i === lastIndex ? link.text + ' - ' + yearLabel + newLink.stringify() : null;
			});
		} else {
			// If no insertion point could have been retrieved, rebuild the entire page
			const lines = [
				'{{投稿ブロック依頼|}}',
				'== 依頼 ==',
				"'''新しい依頼は[[Wikipedia:投稿ブロック依頼 {{#time:Y年n月|+9 hours}}]]に追加してください。'''",
				`* ${year}年 ${newLink.stringify()}`,
				'<!-- 上記の各月リンク先を編集する場合、連動して[[Template:投稿ブロック依頼]]の編集も必要となります -->',
				'{{投稿ブロック依頼過去ログ|}}',
				'{{DEFAULTSORT:とうこうふろつくいらい}}',
				'[[Category:投稿ブロック]]',
				'[[Category:投稿ブロック依頼|*]]'
			];
			newContent = lines.join('\n');
		}

		return {
			text: newContent,
			summary: 'Bot: 月次更新処理',
			minor: true
		};

	});

}

/**
 * Purges the cache for RFB-related pages in the background shortly after 15:00 UTC.
 *
 * @returns A Promise that resolves once the purge process has completed.
 */
async function purge(): Promise<void> {
	console.log('Scheduled background purge for RFB-related pages.');
	await Util.sleep(millisecondsUntilUTC15());
	getMwbot().purge([
		'Wikipedia:投稿ブロック依頼',
		'MediaWiki:Recentchangestext',
		'Template:意見募集中',
		'Template:依頼'
	], {
		forcerecursivelinkupdate: true
	}).then(({ purge }) => {
		console.log('[Background task] Cache purge completed for the following pages:');
		console.group();
		console.log(`- Current time: ${new Date().toISOString()}`);
		purge.forEach(({ title, purged }) => {
			const result = purged ? 'Success' : 'Failure';
			console.log(`- ${title}: ${result}`);
		});
		console.groupEnd();
	}).catch((err) => {
		console.error('[Background task] Cache purge failed for RFB-related pages.');
		console.dir(err, { depth: 3 });
	});
}

/**
 * Returns the number of milliseconds remaining until the next occurrence of 15:00 UTC **today**.
 *
 * If the current time is before 15:00 UTC today, this returns the number of milliseconds
 * until that time. If the current time is already past 15:00 UTC, it returns `0`.
 *
 * @returns The number of milliseconds remaining until 15:00 UTC today, or `0` if already past.
 */
function millisecondsUntilUTC15(): number {
	const now = new Date();

	// Construct a Date object representing today at 15:00 UTC
	const target = new Date(Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
		15, 0, 0, 0 // 15:00:00.000 UTC
	));

	// Calculate the difference in milliseconds between now and 15:00 UTC
	const diff = target.getTime() - now.getTime();

	// If already past 15:00 UTC, return 0
	return Math.max(diff, 0);
}

/**
 * Creates [[Wikipedia:投稿ブロック依頼 YYYY年]] for the upcoming year.
 *
 * @param dates
 * @param debuggingMode
 * @returns A Promise that resolves with the edit result, or rejects if the edit fails.
 *
 * If the page already exists, the edit will fail.
 */
function createYearlySubpage(dates: DateMap, debuggingMode: boolean) {

	const year = dates.next.year;
	const lines = [
		'__NOTOC__',
		'<!--',
		...[...Array(12)].map((_, i) => '{{' + createSubpageTitle(year, i + 1) + '}}'),
		'-->',
		'{{投稿ブロック依頼過去ログ}}',
		'<!-- 本ページでの直接節編集が可能なように、月別の見出し（例：「== 1月 ==」）は各ページ内に設定してください。 -->',
		`<noinclude>[[Category:投稿ブロック依頼|済 ${year}]]</noinclude>`
	];

	const title = prefix(debuggingMode) + createSubpageTitle(year);
	console.log(`Creating ${title}...`);
	return getMwbot().create(title, lines.join('\n'), 'Bot: 年次更新処理');

}

/**
 * Updates [[Template:投稿ブロック依頼過去ログ]] by adding a link to the page created in
 * {@link createYearlySubpage}.
 *
 * @param dates
 * @param debuggingMode
 * @returns A Promise that resolves with the edit result, or rejects if the edit fails.
 *
 * If the page does not exist, the edit will fail.
 */
function updateArchiveTemplate(dates: DateMap, debuggingMode: boolean) {

	const mwbot = getMwbot();
	const { current, next } = dates;

	const title = prefix(debuggingMode) + `Template:投稿ブロック依頼過去ログ`;
	console.log(`Updating ${title}...`);
	return mwbot.edit(title, (wikitext) => {

		// Add a link targeting the current year's subpage
		let linkAdded = false;
		const curYearTitle = new mwbot.Title(createSubpageTitle(current.year));
		const newLink = new mwbot.Wikilink(createSubpageTitle(next.year), `${next.year}年`);

		const oldContent = wikitext.content;
		const newContent = wikitext.modifyWikilinks((link) => {
			const isCurYearLink =
				!linkAdded && !link.skip &&
				mwbot.Wikilink.is(link, 'ParsedWikilink') && link.title.equals(curYearTitle);
			if (isCurYearLink) {
				linkAdded = true;
				return link.text + ' - ' + newLink.stringify();
			} else {
				return null;
			}
		});

		if (oldContent === newContent) {
			console.log('Edit cancelled: Failed to identify the insertion point of the archive link.');
			return null;
		}

		return {
			text: newContent,
			summary: 'Bot: 年次更新処理',
			minor: true
		};

	});

}