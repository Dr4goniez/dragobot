import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrapes a webpage by URL.
 *
 * @param url
 * @returns A Promise resolving to a Cheerio object or `null`.
 *
 * *This function never rejects*.
 */
export async function scrapeWebpage(url: string): Promise<cheerio.CheerioAPI|null> {
	try {
		const res = await axios.get(url);
		const $ = cheerio.load(res.data);
		return $;
	}
	catch (err) {
		console.error(err);
		return null;
	}
}

/**
 * Creates a new Set containing only the elements that satisfy the provided predicate.
 *
 * This function behaves similarly to `Array.prototype.filter`, but for `Set` instances.
 *
 * @template T The type of elements in the input set.
 * @param set The input `Set` to filter.
 * @param predicate A function that is called for each element in the set.
 * If it returns `true`, the element is included in the result.
 * @returns A new `Set` containing only the elements for which the predicate returned `true`.
 */
export function filterSet<T>(set: Set<T>, predicate: (value: T) => boolean): Set<T> {
	const result = new Set<T>();
	for (const item of set) {
		if (predicate(item)) {
			result.add(item);
		}
	}
	return result;
}