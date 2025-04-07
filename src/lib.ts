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