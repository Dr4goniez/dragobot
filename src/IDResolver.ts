/**
 * A submodule of markup.ts
 */

import { getMwbot } from './mwbot';
import { MwbotError } from 'mwbot-ts';

/**
 * A class to manage the process of converting IDs into usernames.
 * It tracks IDs that are being processed, completed, or determined to be unprocessable.
 */
export class IDResolver {

	private readonly type: 'logid' | 'diffid';
	private readonly list: Map<string, string>;
	private readonly processing: Set<string>;
	private readonly unprocessable: Set<string>;

	constructor(type: 'logid' | 'diffid') {
		this.type = type;
		this.list = new Map<string, string>();
		this.processing = new Set<string>();
		this.unprocessable = new Set<string>();
	}

	/**
	 * Evaluates an ID to determine whether it needs processing.
	 *
	 * * If the ID already has a corresponding username in `list`, that username is returned.
	 * * Otherwise, the ID is added to the `processing` queue, unless flagged as unprocessable
	 *   or already in the queue.
	 *
	 * @param id The ID to evaluate.
	 * @returns The username if already resolved, otherwise `null`.
	 */
	evaluate(id: string): string | null {
		const username = this.list.get(id);
		if (typeof username === 'string') {
			return username;
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
	getProcessingIds(): string[] {
		return [...this.processing];
	}

	/**
	 * Registers a new ID-to-username pair in the `list`, and removes the ID
	 * from the `processing` Set object. IDs marked as unprocessable are skipped.
	 *
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
	 * Marks IDs as unprocessable, removing them from `list` and `processing`.
	 *
	 * @param ids The ID(s) to abandon.
	 * @returns The current instance (for chaining).
	 */
	abandon(ids: string | string[] | Set<string>): this {
		ids = ids instanceof Set ? ids : new Set(ids);
		for (const id of ids) {
			this.list.delete(id);
			this.processing.delete(id);
			this.unprocessable.add(id);
		}
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

	/**
	 * Processes the IDs in `processing` and attempts to convert them to usernames.
	 * * If the conversion succeeds, the ID is moved from `processing` to `list` with
	 *   its corresponding username.
	 * * If the conversion fails, the ID is flagged as unprocessable.
	 *
	 * *This method never rejects*.
	 */
	process(): Promise<this> {
		if (!this.processing.size) {
			return Promise.resolve(this);
		}
		return this.type === 'logid' ? this.processLogIds() : this.processDiffIds();
	}

	/**
	 * Removes from `set` all IDs that belong to the specified batch of a `mwbot.massRequest` call.
	 * Each batch contains up to `mwbot.apilimit` IDs, reflecting the API's multivalue limit.
	 *
	 * @param ids The full list of IDs sent to `massRequest`.
	 * @param batchIndex Zero-based index of the batch within the split requests.
	 * @param set The set from which matching IDs should be removed.
	 */
	private static removeBatchIds(ids: string[], batchIndex: number, set: Set<string>): void {
		const mwbot = getMwbot();
		const startIndex = mwbot.apilimit * batchIndex;
		const endIndex = Math.min(startIndex + mwbot.apilimit, ids.length);
		for (let i = startIndex; i < endIndex; i++) {
			set.delete(ids[i]);
		}
	}

	private async processLogIds(): Promise<this> {
		const ids = this.getProcessingIds();
		const response = await getMwbot().massRequest({
			list: 'logevents',
			leprop: 'ids|title',
			letype: 'newusers',
			leids: ids,
			lelimit: 'max'
		}, 'leids');

		const processedMap: Record<string, string> = Object.create(null);
		const unprocessed = new Set(ids);
		for (let i = 0; i < response.length; i++) {
			const res = response[i];

			// On error, exclude this batch from 'unprocessed' so it can be retried in a future call
			if (res instanceof MwbotError) {
				console.dir(res, { depth: 3 });
				if (response.length === 1) {
					// Single-batch request: keep IDs in `processing` for automatic retry
					return this;
				}
				IDResolver.removeBatchIds(ids, i, unprocessed);
				continue;
			}

			const logevents = res.query?.logevents;
			if (!logevents) {
				console.warn('Encountered an undefined "logevents" array.');
				IDResolver.removeBatchIds(ids, i, unprocessed);
				continue;
			}
			for (const { logid, title } of logevents) {
				if (typeof logid !== 'number' || !title) {
					continue; // Revdel'd or prop unexpectedly missing; unprocessable
				}
				const id = String(logid);
				processedMap[id] = title.replace(/^利用者:/, '');
				unprocessed.delete(id);
			}
		}

		return this.register(processedMap).abandon(unprocessed);
	}

	private async processDiffIds(): Promise<this> {
		const ids = this.getProcessingIds();
		const response = await getMwbot().massRequest({
			revids: ids,
			prop: 'revisions',
			rvprop: 'ids|user'
		}, 'revids');

		const processedMap: Record<string, string> = Object.create(null);
		const unprocessed = new Set(ids);
		for (let i = 0; i < response.length; i++) {
			const res = response[i];

			// On error, remove the relevant IDs from `unprocessed` so they can be retried later
			if (res instanceof MwbotError) {
				console.dir(res, { depth: 3 });
				if (response.length === 1) {
					// Single-batch request: keep IDs in `processing` for automatic retry
					return this;
				}
				IDResolver.removeBatchIds(ids, i, unprocessed);
				continue;
			}

			const pages = res.query?.pages;
			if (!pages) {
				console.warn('Encountered an undefined "pages" array.');
				IDResolver.removeBatchIds(ids, i, unprocessed);
				continue;
			}
			for (const { revisions } of pages) {
				if (!revisions) {
					continue;
				}
				for (const { revid, user } of revisions) {
					if (typeof revid !== 'number' || !user) {
						continue; // Revdel'd or prop unexpectedly missing; unprocessable
					}
					const id = String(revid);
					processedMap[id] = user;
					unprocessed.delete(id);
				}
			}
		}

		return this.register(processedMap).abandon(unprocessed);
	}
}