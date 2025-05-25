/**
 * This module is used to close {{UserAN}} templates on administrators' noticeboards
 * when the reported users are locally blocked, globally locked, or globally blocked.
 *
 * The basic parameters of the template are:
 * - {{UserAN|type=USER_TYPE|1=USERNAME|2=BLOCK_STATUS}}.
 *
 * If a non-empty `2=` parameter is present, the template is marked with ✓ and considered closed.
 *
 * This module parses {{UserAN}} templates on the specified pages, identifies the reported users,
 * and, if administrators have taken action against them, sets the `2=` parameter to close the template.
 */

import {
	Mwbot,
	MwbotError,
	Wikitext,
	ParsedTemplate,
	ApiParamsActionEdit,
	PartiallyRequired,
	MultiValue,
	ApiResponse,
	ApiResponseQueryListBlocks,
	ApiResponseQueryListLogevents,
	ApiResponseQueryListGlobalblocks
} from 'mwbot-ts';
import { getMwbot, Util } from './mwbot';
import { IP } from 'ip-wiki';
import { filterSet, scrapeWebpage } from './lib';

/**
 * A class to manage the process of converting IDs into usernames.
 * It tracks IDs that are being processed, completed, or determined to be unprocessable.
 */
class IDList {

	readonly list = new Map<string, string>();
	readonly processing = new Set<string>();
	readonly unprocessable = new Set<string>();

	/**
	 * Evaluates an ID to determine whether it needs processing.
	 * If the ID already has a corresponding username in `list`, that username is returned.
	 * Otherwise, if the ID is not unprocessable and not already being processed,
	 * it is added to the `processing` queue.
	 *
	 * @param id The ID to evaluate.
	 * @returns The username if already resolved, otherwise `null`.
	 */
	evaluate(id: string): string | null {
		if (this.list.has(id)) {
			return this.list.get(id) as string;
		} else if (!this.isUnprocessable(id)) {
			this.processing.add(id);
		}
		return null;
	}

	/**
	 * Returns the IDs currently being processed as an array.
	 *
	 * @returns An array-cast `processing` Set object.
	 */
	getProcessing(): string[] {
		return [...this.processing];
	}

	/**
	 * Registers a new ID-to-username pair in the `list`, and removes the ID
	 * from the `processing` Set object. IDs marked as unprocessable are skipped.
	 *
	 * @param list An object containing ID-username mappings to register.
	 * @param id The log ID.
	 * @param username The username corresponding to the ID.
	 * @returns The current instance (for chaining).
	 */
	register(id: string, username: string): this;
	/**
	 * Registers new ID-to-username pairs in the `list`, and removes the processed IDs
	 * from the `processing` Set object. IDs marked as unprocessable are skipped.
	 *
	 * @param list An object containing ID-username mappings to register.
	 * @returns The current instance (for chaining).
	 */
	register(list: Record<string, string>): this;
	register(idOrList: string | Record<string, string>, username?: string): this {
		let list;
		if (typeof idOrList === 'object') {
			list = idOrList;
		} else {
			if (!username) {
				throw new TypeError(`Expected a string for "username", but got ${typeof username}.`);
			}
			list = { [idOrList]: username };
		}
		Object.entries(list).forEach(([id, user]) => {
			if (!this.isUnprocessable(id)) {
				this.list.set(id, user);
			}
			this.processing.delete(id);
		});
		return this;
	}

	/**
	 * Marks an ID as unprocessable, removing it from `list` and `processing`.
	 *
	 * @param id The ID to abandon.
	 * @returns The current instance (for chaining).
	 */
	abandon(id: string): this {
		this.list.delete(id);
		this.processing.delete(id);
		this.unprocessable.add(id);
		return this;
	}

	/**
	 * Checks whether the specified ID is marked as unprocessable.
	 *
	 * @param id The ID to check.
	 * @returns `true` if the ID is unprocessable; otherwise, `false`.
	 */
	isUnprocessable(id: string): boolean {
		return this.unprocessable.has(id);
	}
}

const logidList = new IDList();
const diffidList = new IDList();
const ANI = 'Wikipedia:管理者伝言板/投稿ブロック';
const ANS = 'Wikipedia:管理者伝言板/投稿ブロック/ソックパペット';
const AN3RR = 'Wikipedia:管理者伝言板/3RR';

/**
 * Marks up UserANs on the administrators' noticeboards.
 *
 * @param checkGlobal Whether to check global lock/block statuses.
 * @returns *This function never rejects*.
 */
export async function markupANs(checkGlobal: boolean): Promise<void> {
	for (const page of [ANI, ANS, AN3RR]) {
		await markupPage(page, checkGlobal);
	}
}

/**
 * Marks up UserANs in a given page.
 *
 * @param page The page to edit.
 * @param checkGlobal Whether to check global lock/block statuses.
 * @returns A Promise resolving to a boolean indicating whether the edit succeeded, or `null` if it was aborted.
 *
 * *This function never rejects*.
 */
export async function markupPage(page: string, checkGlobal: boolean): Promise<boolean | null> {
	console.log(`Checking ${page}...`);
	const res = await getMwbot().edit(page, createTransformationPredicate(page, checkGlobal)).catch((err: MwbotError) => err);
	if (res instanceof Error) {
		if (res.code !== 'aborted') {
			console.dir(res, { depth: 3 });
			return null;
		}
		return false;
	} else {
		console.log('Edit done.');
		return true;
	}
}

/**
 * Creates a callback function for `Mwbot.edit`.
 *
 * @param page The page to edit.
 * @param checkGlobal Whether to check global lock/block statuses.
 * @returns A transformation predicate.
 */
function createTransformationPredicate(page: string, checkGlobal: boolean) {

	return async (wikitext: Wikitext): Promise<ApiParamsActionEdit | null> => {

		const mwbot = getMwbot();

		/**
		 * Sanitizes a username by capitalizing its first letter as MediaWiki does.
		 *
		 * @param str
		 * @returns
		 */
		const sanitizeUsername = (username: string): string => {
			if (/^[\u10A0-\u10FF]/.test(username)) {
				// Georgean letters shouldn't be capitalized
				return username;
			} else {
				return mwbot.Title.phpCharToUpper(Mwbot.String.charAt(username, 0)) + username.slice(1);
			}
		};

		// Collect UserAN templates with unclosed reports
		const templateMap = wikitext.parseTemplates({
			hierarchies: {
				'Template:UserAN': [
					['1', 'user', 'User'],
					['t', 'type', 'Type'],
					['状態', 's', 'status', 'Status']
				]
			}
		}).reduce((acc: Record<string, TemplateInfo>, temp, i) => {

			if (
				!mwbot.Template.is(temp, 'ParsedTemplate') ||
				temp.title.isExternal() || temp.title.getPrefixedDb() !== 'Template:UserAN' ||
				temp.skip
			) {
				return acc;
			}

			/*!********************************************************************************************************\
				A full list of parameter combinations
					params.length === 1
					- [(1=)username] (open)
					params.length === 2
					- [t=TYPE, (1=)username] (open)
					- [(1=)username, 状態=] (open)
					- [(1=)username, 状態=X] (closed)
					- [(1=)username, (2=)無期限] (closed)
					params.length === 3
					- [t=TYPE, (1=)username, 状態=] (open)
					- [t=TYPE, (1=)username, 状態=X] (closed)
					- [t=TYPE, (1=)username, (2=)無期限] (closed)
					- [(1=)username, 状態=, (2=)無期限] (closed)
					params.length === 4
					- [t=TYPE, (1=)username, 状態=, (2=)無期限] (closed)
			\***********************************************************************************************************/

			let len = 0;
			let user = '';
			let typeKey = '';
			let typeVal = '';
			let bot: Date | null = null;
			let hasEmptyStatusParam = false;
			let modified = false;
			for (let { key, value } of Object.values(temp.params)) {
				key = mwbot.Title.clean(key);
				value = mwbot.Title.clean(value);
				if (key === '2') {
					if (value) {
						return acc;
					} else {
						// Don't increment "len" for empty `2=` parameters
					}
				} else if (key === 'bot') {
					let m;
					if (value === 'no') {
						return acc;
					} else if ((m = /20\d{2}-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(Z)?/.exec(value))) {
						const timestamp = m[0] + (m[1] || 'Z'); // Ensure UTC
						bot = new Date(timestamp);
					}
					// Don't increment "len" for `bot=` parameters
				} else if (/^(1|[uU]ser)$/.test(key)) {
					user = value;
					len++;
				} else if (/^(t|[tT]ype)$/.test(key)) {
					typeKey = key;
					typeVal = value.toLowerCase();
					len++;
				} else if (/^(状態|s|[sS]tatus)$/.test(key)) {
					hasEmptyStatusParam = !value;
					len++;
				} else {
					// Don't increment "len" for unsupported keys
					temp.deleteParam(key);
					modified = true;
				}
			}

			const isOpen = ( // Any of the 4 "open" combinations in the list above
				len === 1 && user ||
				len === 2 && user && (typeKey || hasEmptyStatusParam) ||
				len === 3 && user && typeKey && hasEmptyStatusParam
			);
			if (!isOpen) { // This condition includes "!user"
				// This disregards the value of `modified`, but on the premise that the bot runs continuously,
				// we can safely assume that closed UserANs never need to be modified
				return acc;
			}

			const ip = IP.newFromText(user);
			if (!ip && /[/@#<>[\]|{}:]|^(\d{1,3}\.){3}\d{1,3}$/.test(user)) {
				// Ensure the username doesn't contain invalid characters
				return acc;
			}
			typeKey = typeKey || 't';
			typeVal = typeVal || (ip ? 'ip2' : 'user2');

			// Type-dependent modifications
			let logid = '';
			let diffid = '';
			switch (typeVal) {
				case 'user2':
				case 'unl':
				case 'usernolink':
					if (ip) {
						temp.insertParam(typeKey, 'ip2', true, { before: '1' });
						typeVal = 'ip2';
						modified = true;
					}
					break;
				case 'ip2':
				case 'ipuser2':
					if (!ip) {
						temp.deleteParam('t', true);
						typeVal = 'user2';
						modified = true;
					}
					break;
				case 'log':
				case 'logid':
					if (/^\d+$/.test(user)) { // This condition includes "!ip"
						logid = user;
						user = logidList.evaluate(user) || '';
					}
					break;
				case 'diff':
				case 'diffid':
					if (/^\d+$/.test(user)) { // This condition includes "!ip"
						diffid = user;
						user = diffidList.evaluate(user) || '';
					}
					break;
				default: // 'none' or Invalid typeVal (the block status can't be checked)
					if (ip) {
						temp.insertParam(typeKey, 'ip2', true, { before: '1' });
						typeVal = 'ip2';
						modified = true;
					} else {
						user = '';
					}
			}
			if (!user && !ip && !logid && !diffid) {
				// One of these must be present to check block status
				return acc;
			}

			const section = wikitext.identifySection(temp.startIndex, temp.endIndex);
			if (!section) {
				return acc;
			}

			// Retrieve a report timestamp
			const followingText = section.text.slice(section.text.length - (temp.endIndex - section.startIndex)); // Text folllowing the template
			const sig = /(\d{4})年(\d{1,2})月(\d{1,2})日 \(.{1}\) (\d{2}:\d{2}) \(UTC\)/.exec(followingText);
			if (!sig) {
				return acc;
			}
			const ts = sig.map((el) => el.padStart(2, '0')); // MM and DD may be of one digit but they must be of two digits
			const report = new Date(`${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:00Z`); // YYYY-MM-DDThh:mm:00Z (hh:mm is one capturing group)

			acc[i] = {
				temp,
				modified,
				user: ip || sanitizeUsername(user),
				type: typeVal,
				logid,
				diffid,
				refDate: bot ?? new Date(report.getTime() + 5 * 60 * 1000),
				hasBotTimestamp: !!bot,
				sectionTitle: section.title,
				// Properties to be added after block status check
				domain: '',
				duration: '',
				flags: '',
				date: '',
				reblocked: ''
			};

			return acc;
		}, Object.create(null));
		if (Util.isEmptyObject(templateMap)) {
			console.log('Markup cancelled: No open UserANs found.');
			return null;
		}

		// Convert logids and diffids to usernames
		await Promise.all([updateLogids(), updateDiffids()]);
		await processRemainingLogids();

		// Sort registered and IP users
		const users = new Set<string>();
		const ips = new Set<string>();
		Object.entries(templateMap).forEach(([key, obj]) => {

			// Process converted IDs
			const { logid, diffid } = obj;
			if (!obj.user) {
				if (logid) {
					const username = logidList.evaluate(logid);
					if (username) {
						obj.user = username;
					} else {
						logidList.abandon(logid);
					}
				}
				if (diffid) {
					const username = diffidList.evaluate(diffid);
					if (username) {
						obj.user = username;
					} else {
						diffidList.abandon(diffid);
					}
				}
			}

			const user = obj.user;
			if (!user) {
				delete templateMap[key];
			} else if (user instanceof IP) {
				ips.add(user.sanitize(true));
			} else {
				users.add(user);
			}

		});
		if (!users.size && !ips.size) {
			console.log('Markup cancelled: No UserANs can be closed.');
			return null;
		}

		// Check if the users and IPs in the Sets are locally blocked
		const blockInfo = await queryBlockedUsers(users, ips, page === ANS);
		const remainingIps = filterSet(ips, (ip) => !(ip in blockInfo));
		if (remainingIps.size) {
			await queryBlockedIps(blockInfo, remainingIps);
		}

		/**
		 * Object mapping from the names of users that need a reblock, to a Date object referring to the time
		 * after which the reblock must be applied (the `bot` param timestamp or the report timestamp with a
		 * 5-minute extension).
		 */
		const reblockMap: ReblockMap = Object.create(null);

		// Process `blockInfo`, add information to `templateMap`, and extract users to be reblocked
		Object.values(templateMap).forEach((temp) => {

			const username = temp.user instanceof IP ? temp.user.sanitize(true) : temp.user;
			const blocks = blockInfo[username];
			if (!blocks) {
				return;
			}

			// Filter the `blocks` array into an object
			let block;
			if (Array.isArray(blocks)) {
				// Process IPs that have multiple blocks
				// Get the narrowest block applied after the reference date
				const idx = getNarrowestBlockIndex(blocks, temp.refDate);
				if (idx === null) {
					// This IP is blocked but none of the block logs is a new one
					reblockMap[username] = temp.refDate;
					return;
				}
				block = blocks[idx];
			} else {
				block = blocks;
			}

			// Add block information to `templateMap` if the block is new
			const blockDate = new Date(block.timestamp);
			const isNewBlock = blockDate.getTime() > temp.refDate.getTime();
			if (isNewBlock) {

				const flags: string[] = [];
				if (!block.allowusertalk) {
					flags.push('会話×');
				}
				if (block.noemail) {
					flags.push('メール×');
				}
				if (temp.user instanceof IP && !block.anononly) {
					flags.push('ハードブロック');
				}
				const bitLen = !(temp.user instanceof IP) ? '' : (() => {
					const cidr = IP.newFromText(block.user); // This is always an IP instance
					if (cidr && cidr.isCIDR() && cidr.equals(temp.user) === false) {
						return `/${cidr.getBitLength()}で`;
					}
					return '';
				})();

				temp.domain = block.partial ? '部分ブロック' : '';
				temp.duration = bitLen + (block.expiry === 'infinity' ? '無期限' : getBlockDuration(blockDate, block.expiry));
				temp.flags = flags.join('・');
				temp.date = formatDateToMDinGMT9(blockDate);

			} else {
				// This user is blocked but none of the block logs is a new one
				reblockMap[username] = temp.refDate;
			}
		});

		// Check reblock logs as needed
		let reblockInfo: ReblockInfo | null;
		if (Util.isEmptyObject(reblockMap) === false && (reblockInfo = await checkReblocks(reblockMap))) {
			for (const username in reblockMap) {

				const reblock = reblockInfo[username];
				if (!reblock) {
					continue;
				}

				// Domain
				let domain: BlockInfo['domain'] = '';
				if (reblock.old.sitewide && reblock.new.sitewide) {
					// Do nothing
				} else if (reblock.old.sitewide && !reblock.new.sitewide) {
					domain = '部分ブロック';
				} else if (!reblock.old.sitewide && reblock.new.sitewide) {
					domain = 'サイト全体';
				} else if (restrictionsDiffer(reblock.old.restrictions, reblock.new.restrictions)) {
					domain = '部分ブロック条件変更';
				}

				// Duration
				const newExpiry = reblock.new.duration === 'infinity' ? 'infinity' : reblock.new.expiry!;
				const oldExpiry = reblock.old.duration === 'infinity' ? 'infinity' : reblock.old.expiry!;
				const duration = newExpiry !== oldExpiry ? newExpiry : ''; // Empty string if not changed

				// Flags
				const addedFlags = reblock.new.flags.filter((el) => !reblock.old.flags.includes(el));
				const removedFlags = reblock.old.flags.filter((el) => !reblock.new.flags.includes(el));
				const flags: string[] = [];
				if (addedFlags.length || removedFlags.length) {
					[addedFlags, removedFlags].forEach((arr, i) => {
						const removed = i === 1;
						arr.forEach((el) => {
							let msg = '';
							switch (el) {
								case 'anononly':
									msg = removed ? 'ハードブロック' : 'ソフトブロック';
									break;
								case 'nocreate':
									msg = 'アカウント作成' + (removed ? '〇' : '×');
									break;
								case 'noemail':
									msg = 'メール' + (removed ? '〇' : '×');
									break;
								case 'nousertalk':
									msg = '会話' + (removed ? '〇' : '×');
									break;
								case 'noautoblock':
									msg = '自動ブロック' + (removed ? '有' : '無') + '効化';
									break;
								default:
									console.log(`Encountered an unrecognized flag of "${el}".`);
							}
							if (msg) {
								flags.push(msg);
							}
						});
					});

				}

				const reblockDate = new Date(reblock.new.timestamp);
				const key = Object.entries(templateMap).find(([_, obj]) => obj.user instanceof IP ? obj.user.equals(username) : obj.user === username)?.[0];
				if (!key) {
					console.log(`Could not find User:${username} in templateMap.`);
					continue;
				}
				const temp = templateMap[key];
				temp.domain = domain;
				temp.duration = duration === 'infinity'
					? '無期限'
					: duration && getBlockDuration(reblockDate, duration); // Empty string or relative duration
				temp.flags = flags.join('・');
				temp.date = formatDateToMDinGMT9(reblockDate);
				temp.reblocked = '条件変更';

			}
		}

		// Check if the users and IPs in the arrays are globally (b)locked
		do { // Create a break-able block to prevent deep nests

			if (!checkGlobal) {
				break;
			}

			// Only check users that aren't locally blocked
			let gUsers = new Set<string>();
			let gIps = new Set<string>();
			Object.values(templateMap).forEach(({ user, date, hasBotTimestamp }) => {
				if (date || hasBotTimestamp) {
					// Ignore if locally blocked or has a |bot=TIMESTAMP parameter
					return;
				}
				if (user instanceof IP) {
					gIps.add(user.sanitize(true));
				} else {
					gUsers.add(user);
				}
			});
			if (!gUsers.size && !gIps.size) {
				break;
			}

			// Check for global locks
			let lockedUsers: Set<string>;
			if (gUsers.size && (lockedUsers = await queryLockedUsers(gUsers)).size) {
				const lockDate = formatDateToMDinGMT9(new Date());
				lockedUsers.forEach((username) => {
					const key = Object.entries(templateMap).find(([_, obj]) => obj.user instanceof IP ? obj.user.equals(username) : obj.user === username)?.[0];
					if (!key) {
						console.log(`Could not find User:${username} in templateMap.`);
						return;
					}
					const temp = templateMap[key];
					temp.domain = 'グローバルロック';
					temp.date = lockDate;
				});
				gUsers = filterSet(gUsers, (username) => !lockedUsers.has(username));
				if (!gUsers.size && !gIps.size) {
					break;
				}
			}

			// Check for global blocks
			const gblockInfo = await queryGloballyBlockedUsers(gUsers, gIps, page === ANS);
			gIps = filterSet(gIps, (ip) => !(ip in gblockInfo));
			if (gIps.size) {
				await queryGloballyBlockedIps(gblockInfo, gIps);
			}
			if (Util.isEmptyObject(gblockInfo)) {
				break;
			}

			// Process `gblockInfo`, and add information to `templateMap`
			Object.values(templateMap).forEach((temp) => {

				const username = temp.user instanceof IP ? temp.user.sanitize(true) : temp.user;
				const gblocks = gblockInfo[username];
				if (!gblocks) {
					return;
				}

				// Filter the `gblocks` array into an object
				let idx;
				const gblock = Array.isArray(gblocks)
					? ((idx = getNarrowestBlockIndex(gblocks, temp.refDate)) !== null
						? gblocks[idx]
						: null)
					: gblocks;
				if (gblock === null) {
					return;
				}

				// Add global block information to `templateMap` if the block is new
				const gblockDate = new Date(gblock.timestamp);
				const isNewBlock = gblockDate.getTime() > temp.refDate.getTime();
				if (isNewBlock) {

					const bitLen = !(temp.user instanceof IP) ? '' : (() => {
						const cidr = IP.newFromText(gblock.target); // This is always an IP instance
						if (cidr && cidr.isCIDR() && cidr.equals(temp.user) === false) {
							return `/${cidr.getBitLength()}で`;
						}
						return '';
					})();

					temp.domain = 'グローバルブロック';
					temp.duration = bitLen + (gblock.expiry === 'infinity' ? '無期限' : getBlockDuration(gblockDate, gblock.expiry));
					temp.date = formatDateToMDinGMT9(gblockDate);

				}
			});

		// eslint-disable-next-line no-constant-condition
		} while (false); // Always get out of the loop

		// --- All UserAN templates to be marked up have a 'date' property at this point ---

		// Discard templates that can't be marked up, or add a `2=` parameter to those that can
		// Also build a map from section titles to user links for edit summary
		const summaryMap = new Map<string, string[]>();
		const registeredLinks: string[] = [];
		Object.entries(templateMap).forEach(([key, obj]) => {
			// Dump templates that can't be closed
			if (!obj.modified && !obj.date) {
				delete templateMap[key];
				return;
			}

			// Register the title of the section this template is in, in either case of `{ modified: true }` or `{ date: 'M/D' }`
			// The array will be left empty if we can't find any template object with a non-empty `date` property
			const sectionTitle = obj.sectionTitle;
			if (!summaryMap.has(sectionTitle)) {
				summaryMap.set(sectionTitle, []);
			}

			// Add `2=` and generate summary user link if the template can be closed
			if (obj.date) {
				const display = [obj.domain + obj.duration, obj.flags, `(${obj.date})`].filter(Boolean);
				obj.temp.insertParam('2', display.join(' '), true, 'end').deleteParam('bot');

				// Generate a user link to use in summary to let others know who we're marking up
				const userLink = generateSummaryUserLink(obj);
				if (registeredLinks.includes(userLink)) { // Disallow duplicates
					return;
				}
				summaryMap.get(sectionTitle)!.push(userLink);
				registeredLinks.push(userLink);
			}
		});
		if (Util.isEmptyObject(templateMap)) {
			console.log('Markup cancelled: No UserANs are to be modified.');
			return null;
		}

		// Prepare the edit
		const oldContent = wikitext.content;
		let newContent = wikitext.modifyTemplates((_, i) => {
			return templateMap[i]
				? templateMap[i].temp.stringify({ suppressKeys: ['2'] })
				: null;
		});
		if (oldContent === newContent) {
			console.log('Markup cancelled: Same content.');
			return null;
		}

		// Generate summary
		let summary = 'Bot:';
		const modOnly = Array.from(summaryMap.values()).every((links) => links.length === 0);
		if (modOnly) {
			// If no user links are set, it's a modification-only edit
			summary += ' UserANの修正';
		} else {
			outer: for (const [title, links] of summaryMap) {
				if (!links.length) {
					continue;
				}
				// Append both the section title and the first link
				// The reason for processing `link[0]` earlier is because we don't want the summary to end with a section link
				const appendant = ` /*${title}*/ ${links[0]}`;
				if (summary.length + appendant.length <= 497) {
					// Append if it doesn't exceed the summary character limit
					// See https://gerrit.wikimedia.org/g/mediawiki/core/+/ce711e0bb1b615c1cfc959524f11a9344b79f1ea/includes/CommentStore/CommentStore.php#53
					summary += appendant;
				} else {
					// Otherwise, truncate with "etc." and exit
					summary += ' ほか'; // 3 letters; hence 497 above
					break;
				}
				// Append the remaining user links for this section title
				for (let i = 1; i < links.length; i++) {
					const appendant = (summary.endsWith(']]') ? ', ' : ' ') + links[i];
					if (summary.length + appendant.length <= 497) {
						summary += appendant;
					} else {
						summary += ' ほか';
						break outer;
					}
				}
			}
		}

		// If the modified templates are confined to a single section, limit the edit scope to that section
		// This may radically reduce server load, especially helpful for large pages
		let section;
		let sectionIndex: number | undefined = undefined;
		if (
			summaryMap.size === 1 &&
			(section = wikitext.parseSections().find(({ title }) => title === summaryMap.keys().next().value))
		) {
			sectionIndex = section.index;
			newContent = section.text;
		}

		console.log(`Editing ${page}...`);
		return {
			section: sectionIndex, // `mwbot-ts` automatically removes `false` and `undefined` parameters to the API
			text: newContent,
			summary,
			minor: true,
			bot: modOnly // Same here; see also https://www.mediawiki.org/wiki/API:Data_formats#Boolean_parameters
		};
	};

}

/**
 * The text of closed UserANs will be `'domain|duration flags (date)'` (where the pipe represents no space).
 */
interface BlockInfo {
	/**
	 * The domain of the (b)lock. When marking up a UserAN, this text leads the template message.
	 */
	domain: '' | '部分ブロック' | 'サイト全体' | '部分ブロック条件変更' | 'グローバルロック' | 'グローバルブロック';
	/**
	 * A relative duration of the (global) block, set if the user is blocked. For locked users,
	 * this property is never set because global locks don't have the concept of duration.
	 */
	duration: string;
	/**
	 * Flags of the block (e.g., `'nousertalk'`, `'noemail'`) flattened to one string.
	 */
	flags: string;
	/**
	 * The date of the local block, global lock, or global block in an `M/D` format. If the
	 * template can be marked up as closed, this property always has a non-empty value.
	 */
	date: string;
	/**
	 * This property is non-empty only if the user has been reblocked and the report can be closed
	 * based on it.
	 */
	reblocked: '' | '条件変更';
}

interface TemplateInfo extends BlockInfo {
	temp: ParsedTemplate;
	modified: boolean;
	user: string | IP;
	type: string;
	logid: string;
	diffid: string;
	/**
	 * The reference date for the report, initialized either from the report's timestamp or a `bot=`
	 * parameter timestamp. The report should only be closed if the reportee was blocked *after* this date.
	 * If initialized from the report date, it is extended by 5 minutes to account for blocks applied within
	 * 5 minutes of the report submission.
	 */
	refDate: Date;
	/**
	 * Whether this UserAN has a `bot=TIMESTAMP` parameter.
	 */
	hasBotTimestamp: boolean;
	sectionTitle: string;
}

let leend = '';

/**
 * Performs an `list=logevents` API request for new users and update `logidList`.
 *
 * @returns *This function never rejects*.
 */
async function updateLogids(): Promise<void> {

	if (!logidList.processing.size) {
		return;
	}

	const params = {
		list: 'logevents',
		leprop: 'ids|title|timestamp',
		letype: 'newusers',
		lelimit: 'max'
	};
	if (leend) {
		Object.assign(params, { leend });
	}

	// With `apihighlimits`, the API returns 5000 entries. So there isn't much need to use continuedRequest() here
	// const response = await getMwbot().continuedRequest(params, void 0, true);
	const response = await getMwbot().get(params).catch((err) => {
		console.dir(err, { depth: 3 });
		return {} as ApiResponse;
	});
	const resLogevents = response.query?.logevents;
	if (!resLogevents) {
		return;
	}
	let ts = '';
	for (const { timestamp, logid, title } of resLogevents) {
		if (!ts && timestamp) {
			ts = timestamp;
		}
		if (typeof logid === 'number' && title) {
			logidList.register(String(logid), title.replace(/^利用者:/, ''));
		}
	}

	if (ts) {
		leend = ts;
	}

}

/**
 * Performs an `prop=revisions` API request to identify the editor of `diffid` revisions
 * and updates `diffidList`.
 *
 * @returns *This function never rejects*.
 */
async function updateDiffids(): Promise<void> {

	if (!diffidList.processing.size) {
		return;
	}

	const params = {
		revids: diffidList.getProcessing(),
		prop: 'revisions',
		rvprop: 'ids|user'
	};
	const response = await getMwbot().massRequest(params, 'revids');

	for (const res of response) {
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			continue;
		}
		const resPages = res.query?.pages;
		if (resPages) {
			for (const { revisions } of resPages) {
				if (!revisions) {
					continue;
				}
				for (const { revid, user } of revisions) {
					if (typeof revid === 'number' && user) {
						diffidList.register(String(revid), user);
					}
				}
			}
		}
		const resBadIds = res.query?.badrevids;
		if (resBadIds) {
			for (const badrevid in resBadIds) {
				diffidList.abandon(badrevid);
			}
		}
	}

}

/**
 * Attempts to convert log IDs that couldn't be converted via a `list=logevents` request
 * to usernames by scraping `[[Special:Log/newusers]]` for each remaining unprocessed log ID.
 * When scraping is done, the fetched usernames are matched with their IDs.
 *
 * @returns *This function never rejects*.
 */
async function processRemainingLogids(): Promise<void> {

	const logids = logidList.getProcessing();
	if (!logids.length) {
		return;
	}

	const queries = logids.map((id) => {
		return scrapeUsernameByLogid(id);
	});
	const result = await Promise.all(queries);
	logids.forEach((id, i) => {
		const username = result[i];
		if (username) {
			logidList.register(id, username);
		}
	});

}

/**
 * Scrapes `[[Special:Log/newusers]]` to associate the given log ID with an username.
 *
 * @param logid
 * @returns A Promise resolving to a username on success or `null` on failure.
 *
 * *This function never rejects*.
 */
async function scrapeUsernameByLogid(logid: string): Promise<string | null> {

	const url = 'https://ja.wikipedia.org/w/index.php?title=Special:Log&logid=' + logid;
	const $ = await scrapeWebpage(url);
	if (!$) return null;

	let $newusers = $('.mw-logline-newusers');
	if ($newusers.length === 0) return null;
	$newusers = $newusers.eq(0);

	let username: string | null = null;
	switch ($newusers.attr('data-mw-logaction')) {
		case 'newusers/create':
		case 'newusers/autocreate':
		case 'newusers/create2': // Created by an existing user
		case 'newusers/byemail': // Created by an existing user and password sent off
			username = $newusers.children('a.mw-userlink').eq(0).text();
			break;
		case 'newusers/forcecreatelocal':
			username = $newusers.children('a').last().text().replace(/^利用者:/, '');
			break;
		default:
	}
	return username;

}

/**
 * Property names from `list=blocks` that are guaranteed to be present when the appropriate `bkprop=`
 * values are specified.
 */
type ApiResponseQueryListBlocksVerifiedProps =
	| 'user' // Missing for automatic blocks: Must be verified in queryBlockedUsers and queryBlockedIps
	| 'timestamp'
	| 'expiry'
	| 'duration-l10n'
	| 'automatic'
	| 'anononly'
	| 'nocreate'
	| 'autoblock'
	| 'noemail'
	| 'hidden'
	| 'allowusertalk'
	| 'partial'
	| 'restrictions';

/**
 * A variant of {@link ApiResponseQueryListBlocks} where some properties (those listed in
 * {@link ApiResponseQueryListBlocksVerifiedProps}) are guaranteed to be present.
 */
type ApiResponseQueryListBlocksVerified = PartiallyRequired<
	ApiResponseQueryListBlocks,
	ApiResponseQueryListBlocksVerifiedProps
>;

/**
 * A mapping of blocked user names to their corresponding block information.
 *
 * For normal users, the value is a single object. For IP users that are affected by multiple blocks,
 * the value is an array of such objects.
 */
interface BlockInfoMap {
	[username: string]: MultiValue<ApiResponseQueryListBlocksVerified>;
}

/**
 * Performs a `list=blocks` API request to check the local block statuses of registered and IP users in bulk.
 * This function creates and returns an object mapping from the name of each blocked user to their block
 * information object.
 *
 * This function does not check `users` and `ips` for their lengths. They should be verified to be non-empty
 * before passing to this function.
 *
 * @param users
 * @param ips
 * @param isANS
 * @returns
 */
async function queryBlockedUsers(users: Set<string>, ips: Set<string>, isANS: boolean): Promise<BlockInfoMap> {

	const params = {
		list: 'blocks',
		bkprop: 'user|timestamp|expiry|restrictions|flags',
		bklimit: 'max',
		bkusers: [...users, ...ips]
	};
	const response = await getMwbot().massRequest(params, 'bkusers');

	return response.reduce((acc: BlockInfoMap, res) => {
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			return acc;
		}
		const resBlocks = res.query?.blocks;
		if (!resBlocks) {
			return acc;
		}
		for (const block of resBlocks) {
			if (
				!block.automatic && block.user &&
				// On WP:AN/S, registered users should be marked up only if they are indef'd
				(!isANS || /* isANS but isIp */ ips.has(block.user) || /* isUser and indef'd */ block.expiry === 'infinity')
			) {
				acc[block.user] = block as ApiResponseQueryListBlocksVerified;
			}
		}
		return acc;
	}, Object.create(null));

}

/**
 * Performs a `list=blocks` API request to check the local block statuses of **IP users** including
 * range blocks. This function modifies the `info` object in place.
 *
 * This function does not check `ips` for its length. It should be verified to be non-empty
 * before passing to this function.
 *
 * @param info
 * @param ips
 * @returns
 */
async function queryBlockedIps(info: BlockInfoMap, ips: Set<string>): Promise<void> {

	const params = {
		list: 'blocks',
		bkprop: 'user|timestamp|expiry|restrictions|flags',
		bklimit: 'max',
		bkip: [...ips]
	};
	const response = await getMwbot().massRequest(params, 'bkip', 1);

	const ipIter = ips.values();
	for (const res of response) {
		const ip = ipIter.next().value as string;
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			continue;
		}
		const resBlocks = res.query?.blocks;
		if (!resBlocks || !resBlocks.length) {
			continue;
		}
		const blockInfo = resBlocks.filter((obj) => !obj.automatic && obj.user) as ApiResponseQueryListBlocksVerified[];
		// IPs can have multiple blocks
		if (blockInfo.length === 1) {
			info[ip] = blockInfo[0]; // Register an object
		} else if (blockInfo.length > 1) {
			info[ip] = blockInfo; // Register an array of objects
		}
	}

}

/**
 * Gets the index of the narrowest block out of an array of IP block information objects.
 *
 * @param blocksArr
 * @param refDate Used to ensure that the selected block entry was generated after this date.
 * @returns The index as a number, or `null` if none matches.
 */
function getNarrowestBlockIndex(
	blocksArr: ApiResponseQueryListBlocksVerified[] | ApiResponseQueryListGlobalblocksVerified[],
	refDate: Date
): number | null {
	let idx: number | null = null;
	let narrowestSubnet;
	for (let i = 0; i < blocksArr.length; i++) {
		const block = blocksArr[i];
		const timestamp = block.timestamp;
		const user = 'user' in block ? block.user : block.target;
		const isNewBlock = new Date(timestamp).getTime() > refDate.getTime();
		const m = user.match(/\/(\d{1,3})$/);
		const subnet = m ? parseInt(m[1]) : user.includes('.') ? 32 : 128;
		if (isNewBlock && (!narrowestSubnet || narrowestSubnet < subnet)) {
			idx = i;
			narrowestSubnet = subnet;
		}
	}
	return idx;
}

/**
 * Gets a human-readable block duration string in Japanese from two timestamps.
 *
 * @param blockTimestamp The block timestamp (ISO string or Date).
 * @param expiryTimestamp The expiry timestamp (ISO string or Date).
 * @returns The duration string.
 * @throws If `expiryTimestamp` precedes `blockTimestamp` (i.e, the former must be
 * later than the latter).
 */
function getBlockDuration(
	blockTimestamp: string | Date,
	expiryTimestamp: string | Date
): string {

	const blockDate = blockTimestamp instanceof Date ? blockTimestamp : new Date(blockTimestamp);
	const expiryDate = expiryTimestamp instanceof Date ? expiryTimestamp : new Date(expiryTimestamp);
	const diffMs = expiryDate.getTime() - blockDate.getTime();
	if (diffMs < 0) {
		throw new Error('"expiryTimestamp" precedes "blockTimestamp".');
	}

	// Duration constants in milliseconds
	const MS = {
		second: 1000,
		minute: 60 * 1000,
		hour:   60 * 60 * 1000,
		day:    24 * 60 * 60 * 1000,
		week:   7 * 24 * 60 * 60 * 1000,
		month:  30 * 24 * 60 * 60 * 1000,
		year:   365 * 24 * 60 * 60 * 1000,
	};

	// Define units and labels in descending order
	interface UnitMap {
		key: keyof typeof MS;
		label: string;
		/** The criterion to promote the number unit to the one-level higher unit. */
		promote: number;
		/** Whether to append this unit as a second unit. */
		append: boolean;
	}
	const units: UnitMap[] = [
		{ key: 'year', label: '年', promote: Infinity, append: false },
		{ key: 'month', label: 'か月', promote: 12, append: true },
		{ key: 'week', label: '週間', promote: 4, append: true },
		{ key: 'day', label: '日', promote: 7, append: false },
		{ key: 'hour', label: '時間', promote: 24, append: true },
		{ key: 'minute', label: '分', promote: 60, append: true },
		{ key: 'second', label: '秒', promote: 60, append: true },
	];

	let remainingMs = diffMs;
	const parts: [/* value */ number, /* label */ string][] = [];
	let breakIn: number | null = null;

	for (let i = 0; i < units.length; i++) {
		const { key, label, promote, append } = units[i];
		let value = Math.floor(remainingMs / MS[key]);
		if (value > 0) {

			// We have already collected a higher unit
			if (parts.length) {
				// Promote the current unit if possible
				if (value >= promote) {
					parts[0][0] += Math.floor(value / promote);
					value %= promote;
					if (value === 0) {
						break;
					}
				}
				// Exit iteration if this unit disallows appendage
				if (!append) {
					break;
				}
			}

			parts.push([value, label]);
			if (parts.length === 2) {
				break;
			}
			remainingMs -= value * MS[key];
			breakIn = i + 1; // Always break in the next iteration to prevent e.g. "1 year 3 seconds"
		}
		if (i === breakIn) {
			break;
		}
	}

	// Convert "1 day 7 hours" to "31 hours"
	if (
		parts.length === 2 &&
		parts[0][0] === 1 && parts[0][1] === '日' &&
		parts[1][0] === 7 && parts[1][1] === '時間'
	) {
		return '31時間';
	}

	return parts.length > 0 ? parts.flat().join('') : '0秒';
}

/**
 * Formats a UTC-based Date object to `M/D` in the GMT+9 time zone.
 *
 * @param date
 * @returns
 */
function formatDateToMDinGMT9(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Tokyo', // GMT+9
		month: 'numeric',
		day: 'numeric',
	}).format(date);
}

/**
 * Object mapping from usernames that need a reblock, to a reference date (a 5-min-extended date
 * of the report submission or a date specified by a `bot=` parameter).
 */
interface ReblockMap {
	[username: string]: Date;
}

/**
 * Available flags of a block log.
 */
type BlockFlags = 'anononly' | 'nocreate' | 'noemail' | 'nousertalk' | 'noautoblock';

type ApiResponseQueryListLogeventsRestrictions =
	NonNullable<NonNullable<ApiResponseQueryListLogevents['params']>['restrictions']>;

/**
 * Sanitized block parameters, used to normalize block log entries.
 */
interface SanitizedBlockParams {
	duration: string;
	expiry?: string;
	flags: BlockFlags[];
	sitewide: boolean;
	restrictions?: ApiResponseQueryListLogeventsRestrictions;
	timestamp: string;
}

/**
 * Object mapping from usernames to their reblock logs. `new` is the newest reblock log generated
 * *after* the reference date, and `old` is an older (re)block log generated *before* (or *at the
 * same time as*) the reference date.
 */
interface ReblockInfo {
	[username: string]: {
		new: SanitizedBlockParams;
		old: SanitizedBlockParams;
	};
}

/**
 * Checks for reblocks based on a map of usernames and the reference timestamp.
 *
 * This function does not check if `reblockMap` is empty. It should be verified to be non-empty
 * before passing to this function.
 *
 * @param reblockMap
 * @returns A Promise resolving to {@link ReblockInfo} if some users have been reblocked,
 * or `null` if not.
 */
async function checkReblocks(reblockMap: ReblockMap): Promise<ReblockInfo | null> {

	const users = Object.keys(reblockMap);

	const response = await getMwbot().massRequest({
		list: 'logevents',
		letype: 'block',
		letitle: users.map((username) => `利用者:${username}`)
	}, 'letitle', 1);

	const ret: ReblockInfo = Object.create(null);
	for (let i = 0; i < response.length; i++) {

		const res = response[i];
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			continue;
		}
		const resLogevents = res.query?.logevents;
		if (!resLogevents || !resLogevents.length) {
			continue;
		}
		const username = users[i];
		const refDate = reblockMap[username];
		const isAfterReferenceDate = (timestamp: string): boolean => {
			return new Date(timestamp).getTime() > refDate.getTime();
		};

		let newBlock: ApiResponseQueryListLogevents | null = null;
		let oldBlock: ApiResponseQueryListLogevents | null = null;
		for (const obj of resLogevents) {
			// Ensure existence of some properties
			// No need to look at unblock logs (and see if there's a newer block log) beucase we know the user is currently blocked
			const { action, timestamp, params } = obj;
			if (!action || !['block', 'reblock'].includes(action) || !timestamp || !params) {
				continue;
			}

			// Save the first reblock log generated after the report submission to `newBlock`
			if (action === 'reblock' && !newBlock && isAfterReferenceDate(timestamp)) {
				newBlock = obj;
			}
			// Save a (re)block log generated before the report submission to `oldBlock`,
			// ensuring that the relevant block is still in effect
			else if (
				// This is a (re)block log generated before or at the same time as the reference date.
				// Note that a negated `isAfterReferenceDate` includes "before or at the same time as".
				newBlock && !oldBlock && !isAfterReferenceDate(timestamp) &&
				// The block hasn't expired yet (note: `expiry` is missing if `duration` is `'infinity'`,
				// but if it's not, it's an ISO timestamp)
				(params.duration === 'infinity' || params.expiry && isAfterReferenceDate(params.expiry))
			) {
				oldBlock = obj;
				break;
			}
			// If we find a block log before finding a reblock log, the user hasn't been reblocked
			else if (!newBlock && action === 'block') {
				break;
			}
		}
		if (newBlock && oldBlock) {
			ret[username] = {
				new: sanitizeParams(newBlock),
				old: sanitizeParams(oldBlock)
			};
		}

	}

	return !Util.isEmptyObject(ret) ? ret : null;

	function sanitizeParams(blockLog: ApiResponseQueryListLogevents): SanitizedBlockParams {
		const params = blockLog.params!; // Already ensured this property is present
		return {
			duration: params.duration as string, // Always present
			expiry: params.expiry, // Missing if `duration` is `'infinity'`
			flags: (params.flags || []) as BlockFlags[],
			sitewide: !!params.sitewide,
			restrictions: params.restrictions,
			timestamp: blockLog.timestamp as string, // Already verified presence
		};
	}

}

/**
 * Compares the `restrictions` properties of two block logs and checks if they differ.
 *
 * @param rest1
 * @param rest2
 */
function restrictionsDiffer(
	rest1?: ApiResponseQueryListLogeventsRestrictions,
	rest2?: ApiResponseQueryListLogeventsRestrictions
): boolean {
	// If one is defined and the other is not
	if (!rest1 && rest2 || rest1 && !rest2) return true;

	// If both are undefined, they're equal
	if (!rest1 && !rest2) return false;

	// At this point, both are defined
	const { pages: pages1, namespaces: namespaces1, actions: actions1 } = rest1!;
	const { pages: pages2, namespaces: namespaces2, actions: actions2 } = rest2!;

	if (typeof pages1 !== typeof pages2 || (pages1 && pages2 && !Util.arraysEqual(
		pages1.map(p => p.page_title),
		pages2.map(p => p.page_title),
		true
	))) {
		return true;
	}

	if (
		typeof namespaces1 !== typeof namespaces2 ||
		(namespaces1 && namespaces2 && !Util.arraysEqual(namespaces1, namespaces2, true))
	) {
		return true;
	}

	if (
		typeof actions1 !== typeof actions2 ||
		(actions1 && actions2 && !Util.arraysEqual(actions1, actions2, true))
	) {
		return true;
	}
	return false;
}

/**
 * Performs `list=globalallusers&aguprop=lockinfo` API requests to check the lock statuses of
 * registered users, and returns an array of locked usernames.
 *
 * This function does not check `users` for its length. It should be verified to be non-empty
 * before passing to this function.
 *
 * @param users
 * @returns *This function never rejects*.
 */
async function queryLockedUsers(users: Set<string>): Promise<Set<string>> {

	const usersArr = [...users];
	const params = {
		list: 'globalallusers',
		agufrom: usersArr,
		aguto: usersArr,
		aguprop: 'lockinfo',
		agulimit: 1
	};
	const response = await getMwbot().massRequest(params, ['agufrom', 'aguto'], 1);

	return response.reduce((acc, res, i) => {
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			return acc;
		}
		const resAgusers = res.query?.globalallusers;
		if (!resAgusers) {
			return acc;
		}
		const username = usersArr[i];
		if (!resAgusers[0]) {
			console.warn(`User:${username} doesn't appear to exist.`);
			return acc;
		}
		if (resAgusers[0].locked === '') {
			acc.add(username);
		}
		return acc;
	}, new Set<string>());

}

type ApiResponseQueryListGlobalblocksVerifiedProps =
	| 'target'
	| 'timestamp'
	| 'expiry';

/**
 * A variant of {@link ApiResponseQueryListGlobalblocks} where some properties (those listed in
 * {@link ApiResponseQueryListGlobalblocksVerifiedProps}) are guaranteed to be present.
 */
type ApiResponseQueryListGlobalblocksVerified = PartiallyRequired<
	ApiResponseQueryListGlobalblocks,
	ApiResponseQueryListGlobalblocksVerifiedProps
>;

/**
 * A mapping of globally blocked user names to their corresponding block information.
 *
 * For normal users, the value is a single object. For IP users that are affected by multiple blocks,
 * the value is an array of such objects.
 */
interface GlobalBlockInfoMap {
	[username: string]: ApiResponseQueryListGlobalblocksVerified | ApiResponseQueryListGlobalblocksVerified[];
}

/**
 * Performs a `list=globalblocks` API request to check the global block statuses of registered and IP users in bulk.
 * This function creates and returns an object mapping from the name of each globally blocked user to their block
 * information object.
 *
 * This function does not check `users` and `ips` for their lengths. They should be verified to be non-empty
 * before passing to this function.
 *
 * @param users
 * @param ips
 * @param isANS
 * @returns
 */
async function queryGloballyBlockedUsers(users: Set<string>, ips: Set<string>, isANS: boolean): Promise<GlobalBlockInfoMap> {

	const params = {
		list: 'globalblocks',
		bgtargets: [...users, ...ips],
		bgprop: 'target|timestamp|expiry',
		bglimit: 'max'
	};

	const response = await getMwbot().massRequest(params, 'bgtargets');

	return response.reduce((acc: GlobalBlockInfoMap, res) => {
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			return acc;
		}
		const resGblocks = res.query?.globalblocks;
		if (!resGblocks || !resGblocks.length) {
			return acc;
		}
		for (const gblock of resGblocks) {
			if (gblock.automatic || !gblock.target || !gblock.timestamp || !gblock.expiry) {
				continue;
			}
			if (isANS && users.has(gblock.target) && gblock.expiry !== 'infinity') {
				continue;
			}
			acc[gblock.target] = gblock as ApiResponseQueryListGlobalblocksVerified;
		}
		return acc;
	}, Object.create(null));

}

/**
 * Performs `list=globalblocks` API requests to check the global block statuses of **IP users** including
 * range blocks. This function modifies the `info` object in place.
 *
 * This function does not check `ips` for its length. It should be verified to be non-empty
 * before passing to this function.
 *
 * @param info
 * @param ips
 * @returns
 */
async function queryGloballyBlockedIps(info: GlobalBlockInfoMap, ips: Set<string>): Promise<void> {

	const params = {
		list: 'globalblocks',
		bgip: [...ips],
		bgprop: 'target|timestamp|expiry',
		bglimit: 'max'
	};

	const response = await getMwbot().massRequest(params, 'bgip', 1);

	const ipsIter = ips.values();
	for (const res of response) {
		const ip = ipsIter.next().value as string;
		if (res instanceof Error) {
			console.dir(res, { depth: 3 });
			continue;
		}
		const resGblocks = res.query?.globalblocks;
		if (!resGblocks || !resGblocks.length) {
			continue;
		}
		const gblockInfo = resGblocks.filter(({ automatic, target, timestamp, expiry }) =>
			!automatic && target && timestamp && expiry
		) as ApiResponseQueryListGlobalblocksVerified[];
		if (gblockInfo.length === 1) {
			info[ip] = gblockInfo[0];
		} else if (gblockInfo.length > 1) {
			info[ip] = gblockInfo;
		}
	}

}

/**
 * Generates a user link for edit summary from a fully processed template info object.
 *
 * @param info
 * @returns
 */
function generateSummaryUserLink(info: TemplateInfo): string {
	const status = info.reblocked || info.domain + info.duration;
	const username = info.user instanceof IP ? info.user.abbreviate() : info.user;
	if (/^(user2|unl|usernolink)$/.test(info.type)) {
		const maxLetterCnt = containsJapaneseCharacter(username) ? 10 : 20;
		if (username.length > maxLetterCnt) {
			return `${username.substring(0, maxLetterCnt)}.. (${status})`;
		} else {
			return `[[特別:投稿記録/${username}|${username}]] (${status})`;
		}
	} else if (/^ip(user)?2$/.test(info.type)) {
		return `[[特別:投稿記録/${username}|${username}]] (${status})`;
	} else if (/^log(id)?$/.test(info.type)) {
		return `[[特別:転送/logid/${info.logid}|Logid/${info.logid}]] (${status})`;
	} else if (/^diff(id)?$/.test(info.type)) {
		return `[[特別:差分/${info.diffid}|差分/${info.diffid}]]の投稿者 (${status})`;
	} else {
		console.error(`Encountered an unexpected UserAN type: "${info.type}".`);
		return '';
	}
}

/**
 * Check whether a string contains a Japanese character.
 */
function containsJapaneseCharacter(str: string): boolean {
	return /[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]/.test(str);
}