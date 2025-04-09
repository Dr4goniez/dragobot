import { Mwbot, MwbotInitOptions } from 'mwbot-ts';
import { creds } from './creds';
import { VERSION } from './version';

export const Util = Mwbot.Util;

let mwbot: Mwbot;

/**
 * Initializes an Mwbot instance.
 *
 * @param user The user account to use.
 * @returns A Promise resolving to an Mwbot instance.
 */
export async function init(user: keyof typeof creds): Promise<Mwbot> {
	const initOptions: MwbotInitOptions = {
		apiUrl: 'https://ja.wikipedia.org/w/api.php',
		userAgent: `dragobot/${VERSION} (https://github.com/Dr4goniez/dragobot)`,
		...creds[user]
	};
	mwbot = await new Mwbot(initOptions).init();
	return mwbot;
}

/**
 * Gets the initialized Mwbot instance.
 *
 * @returns The Mwbot instance.
 * @throws If {@link init} hasn't been called.
 */
export function getMwbot(): Mwbot {
	if (!mwbot) {
		throw new Error('"mwbot" has not been initialized.');
	}
	return mwbot;
}