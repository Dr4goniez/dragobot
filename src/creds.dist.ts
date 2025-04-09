/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * This sample module provides an example of how to organize and store credential information.
 */

import { Credentials } from 'mwbot-ts';

/**
 * Iconic names of your applications.
 */
type Apps = 'foo' | 'bar' | 'baz' | 'anon';

/**
 * Credential store for all applications.
 * Replace the placeholder values with actual credentials when used in a real project.
 */
export const creds: Record<Apps, {credentials: Credentials}> = {
	foo: {
		/**
		 * OAuth 2.0 authentication
		 */
		credentials: {
			oAuth2AccessToken: 'Your OAuth 2.0 access token'
		}
	},
	bar: {
		/**
		 * OAuth 1.0a authentication
		 */
		credentials: {
			consumerToken: 'Your OAuth 1.0a consumer token',
			consumerSecret: 'Your OAuth 1.0a consumer secret',
			accessToken: 'Your OAuth 1.0a access token',
			accessSecret: 'Your OAuth 1.0a access secret',
		}
	},
	baz: {
		/**
		 * BotPassword authentication
		 */
		credentials: {
			username: "Your bot's username",
			password: "Your bot's password"
		}
	},
	anon: {
		/**
		 * Anonymous authentication (read-only)
		 */
		credentials: {
			anonymous: true
		}
	}
};

// Example usage (in another module):

import { Mwbot, MwbotInitOptions } from 'mwbot-ts';
// import { creds } from './creds';

const initOptions: MwbotInitOptions = {
	apiUrl: 'https://en.wikipedia.org/w/api.php',
	userAgent: 'foobot/1.0.0 (https://github.com/Foo/foobot)',
	...creds['foo']
};

new Mwbot(initOptions).init().then((mwbot) => {
	// Use the initialized Mwbot instance...
});