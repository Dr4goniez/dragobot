/**
 * This module serves to remove `{{pp}}` templates from unprotected pages.
 */

import { ApiParamsActionEdit, ApiResponse, ApiResponseQueryPagesPropInfoProtection, MwbotError, Wikitext } from 'mwbot-ts';
import { getMwbot, Util } from './mwbot';
import { filterSet } from './lib';

const ppTitles = [
	// Note: Spaces must be replaced with underscores
	'Pp',
	'Pp-dispute',
	'Pp-move',
	'Pp-move-dispute',
	'Pp-move-vandalism',
	'Pp-move-vand',
	'Pp-move-vd',
	'Pp-office',
	'Pp-office-dmca',
	'Pp-permanent',
	'Pp-reset',
	'Pp-semi-indef',
	'Pp-template',
	'Pp-vandalism',
	'Pp-vand',
	'Pp-vd',
	'保護', // Master
	'保護S',
	'保護s',
	'全保護',
	'半保護', // Master
	'Sprotected',
	'半保護S',
	'拡張半保護', // Master
	'保護運用', // Master
	'半保護運用',
	'半永久保護',
	'移動保護',
	'移動拡張半保護'
];
/**
 * A set of **prefixed** `{{pp}}`-template titles.
 */
const pp = new Set(ppTitles.map((el) => 'Template:' + el));

const escapedPpSubpages = Array.from(pp).map((el) => Util.escapeRegExp(el + '/'));
/**
 * A regular expression that matches with `{{pp}}`-templates' subpage titles.
 */
const rPpSubpages = new RegExp(`^(${escapedPpSubpages.join('|')})`);

const excludeNamespaces = new Set([
	2, // User
	8, // MediaWiki
	828 // Module
]);
const excludeTitles = new Set([
	'Wikipedia:主要なテンプレート/メンテナンス',
	'Template‐ノート:Pp/testcases',
	'Template:Pp-meta/sandbox'
]);

/**
 * Searches for unprotected pages with `{{pp}}` templates and removes them if found.
 *
 * @param quitBefore Ensures the procedure quits 10 seconds before this UNIX time,
 * if the function is still running close to the bot’s next scheduled run.
 * @returns
 */
export async function removePp(quitBefore: number): Promise<void> {

	console.log('Checking for {{pp}} templates to remove from pages...');

	const transclusions = await getPpTransclusions();
	if (!transclusions.size) {
		return found(0);
	}

	const protectedPages = await filterProtected(transclusions);
	if (!protectedPages) {
		return console.log('Check cancelled: Failed to filter protected pages.');
	}

	const unprotectedPages = filterSet(transclusions, (page) => !protectedPages.has(page));
	found(unprotectedPages.size);
	if (!unprotectedPages.size) {
		return;
	}

	const mwbot = getMwbot();
	for (const page of unprotectedPages) {
		if (Date.now() > quitBefore - 10_000) {
			console.log('The next procedure starts within 10 seconds: Postpone editing the remaining pages.');
			break;
		}
		console.log(`Editing ${page}...`);
		const result = await mwbot.edit(page, createTransformationPredicate(page)).catch((err: MwbotError) => err);
		if (result instanceof MwbotError) {
			if (result.code !== 'aborted') {
				console.dir(result, {depth: 3});
				console.log('Edit failed.');
			}
		} else {
			console.log('Edit done.');
		}
	}

}

/**
 * Gets a list of page titles that transclude `pp` templates.
 *
 * @returns A list of page titles.
 *
 * *This function never rejects*.
 */
async function getPpTransclusions(): Promise<Set<string>> {

	const mwbot = getMwbot();

	const batches: Array<Promise<ApiResponse>> = [];
	for (const temp of pp) {
		batches.push(
			mwbot.continuedRequest({
				titles: temp,
				prop: 'transcludedin',
				tiprop: 'title',
				tilimit: 'max'
			}, Infinity, true)
		);
	}

	const responses = await Promise.all(batches);
	const ret = new Set<string>();
	for (const res of responses) {
		const resPages = res.query?.pages;
		if (!resPages) {
			continue;
		}
		resPages.forEach(({transcludedin}) => {
			if (!transcludedin) {
				return;
			}
			for (const {ns, title} of transcludedin) {
				if (
					typeof ns !== 'number' || !title ||
					excludeNamespaces.has(ns) || excludeTitles.has(title) || rPpSubpages.test(title) ||
					// Avoid potential script pages in a subject namespace
					(ns % 2 === 0 && /\.(js|css|json)$/.test(title))
				) {
					continue;
				}
				ret.add(title);
			}
		});
	}

	// Remove subpages of pp templates and return the result
	return ret;

}

/**
 * Logs the number of pages found.
 *
 * @param count
 */
function found(count: number): void {
	const plural = count === 1 ? '' :  's';
	console.log(`${count} page${plural} found.`);
}

/**
 * Filters protected pages from a list of page titles.
 *
 * @param pages
 * @returns A Promise resolving to an array of protected page titles, or `null`.
 *
 * Returns `null` if any internal request fails. In that case, the list of protected pages
 * is incomplete and should not be used to check if a page is unprotected.
 *
 * *This function never rejects.*
 */
async function filterProtected(pages: Set<string>): Promise<Set<string> | null> {

	const response = await getMwbot().massRequest({
		titles: [...pages],
		prop: 'info',
		inprop: 'protection'
	}, 'titles');

	const now = Date.now();
	const ret = new Set<string>();
	for (const res of response) {
		if (res instanceof Error) {
			console.dir(res, {depth: 3});
			return null;
		}
		const resPages = res.query?.pages;
		if (!resPages) {
			return null;
		}
		for (const {title, protection} of resPages) {
			if (!protection) {
				return null;
			}
			if (!protection.length) { // The page is not protected
				continue;
			}
			if (isProtected(protection, now)) {
				// The `title` property may be missing only if invalid page/revision IDs are passed
				ret.add(title as string);
			}
		}
	}

	return ret;

}

/**
 * Checks whether an array of {@link ApiResponseQueryPagesPropInfoProtection} indicates that
 * its associated page is currently protected.
 *
 * @param protectionArray
 * @param now A UNIX timestamp of the current time.
 * @returns
 */
function isProtected(protectionArray: ApiResponseQueryPagesPropInfoProtection[], now: number): boolean {
	return protectionArray.some(({expiry}) => /^in/.test(expiry) || Date.parse(expiry) > now);
}

/**
 * Creates a callback function for `Mwbot.edit`.
 *
 * @param page The page to edit.
 * @returns A transformation predicate.
 */
function createTransformationPredicate(page: string) {
	return (wikitext: Wikitext): ApiParamsActionEdit | null => {

		const mwbot = getMwbot();

		// Remove `pp` templates from the content
		const oldContent = wikitext.content;
		let newContent = wikitext.modifyTemplates((temp) => {
			const isPp =
				!temp.skip &&
				mwbot.Template.is(temp, 'ParsedTemplate') &&
				!temp.title.isExternal() && pp.has(temp.title.getPrefixedDb());
			return isPp ? '' : null;
		});
		if (oldContent === newContent) {
			console.log('Edit cancelled: No {{pp}} templates found in the page.');
			console.log(`Excluded from future checks: "${page}".`);
			excludeTitles.add(page);
			return null;
		}

		// If there are any empty <noinclude> tags left in the page, remove them as well
		newContent = wikitext.modifyTags(({name, selfClosing, unclosed, content, skip}) => {
			const isEmptyNoinclude = name === 'noinclude' && !selfClosing && !unclosed && !content?.trim() && !skip;
			return isEmptyNoinclude ? '' : null;
		});

		return {
			text: newContent,
			summary: 'Bot: [[Template:Pp|保護テンプレート]]の除去',
			minor: true,
			bot: true
		};

	};
}