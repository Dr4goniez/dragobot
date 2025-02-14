import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
wrapper(axios);
import packageJson from '../package.json';
import FormData from 'form-data';
import { ApiParams, ApiResponse, ApiResponseError } from './api_types';

export class Mwbot {

	/**
	 * The API endpoint.
	 */
	readonly apiUrl: string;
	/**
	 * Cookie jar for the bot instance - holds session and login cookies.
	 */
	private readonly jar = new CookieJar();
	/**
	 * The user-defined config for HTTP requests.
	 */
	userRequestOptions: MwbotRequestConfig;

	/**
	 * Initialize a new Mwbot instance.
	 * @param apiUrl The API endpoint, e.g. "https://meta.wikimedia.org/w/api.php".
	 * @param options User-defined request options used for all HTTP requests.
	 */
	constructor(apiUrl: string, options: MwbotRequestConfig = {}) {

		if (!apiUrl) {
			throw new Error('No valid API endpoint is provided.');
		}
		this.apiUrl = apiUrl;
		this.userRequestOptions = mergeDeep(options);
		this.userRequestOptions.url = apiUrl;

	}

	/**
	 * An array of `AbortController`s used in {@link abort}.
	 */
	private abortions: AbortController[] = [];
	/**
	 * The default config for HTTP requests.
	 */
	static readonly defaultRequestOptions: MwbotRequestConfig = {
		method: 'GET',
		headers: {
			'User-Agent': `dragobot/${packageJson.version} (https://dragobot.toolforge.org/)`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		params: {
			action: 'query',
			format: 'json',
			formatversion: '2'
		},
		timeout: 60 * 1000, // 60 seconds
		responseType: 'json',
		responseEncoding: 'utf8'
	};

	/**
	 * Make a raw HTTP request. This method does not append anything to `requestOptions` by default.
	 * @param requestOptions The user-defined, full HTTP request options.
	 * @param mwRawRequestOptions Options for whether to use {@link Mwbot}'s internal request options.
	 * @returns The raw response of the HTTP request.
	 */
	rawRequest(requestOptions: MwbotRequestConfig, mwRawRequestOptions: MwbotRawRequestOptions = {}): Promise<AxiosResponse> {

		// Add an AbortController to requestOptions to make it possible to abord this request later
		const controller = new AbortController();
		requestOptions.signal = controller.signal;
		this.abortions.push(controller);

		// Make an HTTP request
		const {useDefaults, useUserOptions, useCookie} = mwRawRequestOptions;
		return axios(
			mergeDeep(
				useDefaults ? Mwbot.defaultRequestOptions : {},
				useUserOptions ? this.userRequestOptions : {},
				requestOptions,
				useCookie ? {jar: this.jar, withCredentials: true} : {}
			)
		);

	}

	async request(parameters: ApiParams, requestOptions: MwbotRequestConfig = {}): Promise<ApiResponse> {

		requestOptions.params = mergeDeep(this.userRequestOptions.params, requestOptions.params, parameters);
		Mwbot.preprocessParameters(requestOptions.params);
		requestOptions = mergeDeep(Mwbot.defaultRequestOptions, this.userRequestOptions, requestOptions);
		if (requestOptions.params.format !== 'json') {
			return rejectWithError({
				code: 'invalidformat',
				info: 'Must use format=json.'
			});
		}

		await Mwbot.preprocessRequestMethod(requestOptions);

		return this.rawRequest(requestOptions, {useCookie: true})
			.then((response) => {
				if (response === void 0 || response === null || !response.data) {
					return rejectWithError({
						code: 'ok-but-empty',
						info: 'OK response but empty result (check HTTP headers?)',
						details: response
					});
				} else if (typeof response.data !== 'object') {
					// In most cases the raw HTML of [[Main page]]
					return rejectWithError({
						code: 'invalidjson',
						info: 'Invalid JSON response (check the request URL?)'
					});
				// When we get a JSON response from the API, it's always a "200 OK"
				} else if (response.data.error) {
					return rejectWithError(response.data.error);
				} else {
					return response.data;
				}
			})
			.catch((error) => {
				if (error && error.code === 'ERR_CANCELED') {
					return rejectWithError({
						code: 'aborted',
						info: 'HTTP request aborted by the user'
					});
				} else {
					return rejectWithError({
						code: 'http',
						info: 'HTTP request failed',
						details: error
					});
				}
			});

	}

	/**
	 * Massage parameters from the nice format we accept into a format suitable for the API.
	 * @param parameters (modified in-place)
	 */
	private static preprocessParameters(parameters: ApiParams): void {
		Object.entries(parameters).forEach(([key, val]) => {
			if (Array.isArray(val)) {
				// Multi-value fields must be stringified
				if (!val.join('').includes('|')) {
					parameters[key] = val.join('|');
				} else {
					parameters[key] = '\x1f' + val.join('\x1f');
				}
			}
			if (val === false || val === undefined) {
				// Boolean values are only false when not given at all
				delete parameters[key];
			} else if (val === true) {
				// Boolean values cause error with multipart/form-data requests
				parameters[key] = '1';
			} else if (val instanceof Date) {
				parameters[key] = val.toISOString();
			}
		});
	}

	private static async preprocessRequestMethod(requestOptions: MwbotRequestConfig): Promise<void> {
		const {method} = requestOptions;
		if (typeof method !== 'string') {
			requestOptions.method = 'GET';
		} else if (/^GET$/.test(method)) {
			// Do nothing
		} else if (/^POST$/.test(method)) {
			await Mwbot.handlePost(requestOptions);
		} else {
			requestOptions.method = 'GET';
		}
	}

	private static async handlePost(requestOptions: MwbotRequestConfig): Promise<void> {
		// Shift the token to the end of the query string, to prevent
		// incomplete data sent from being accepted meaningfully by the server
		const {params} = requestOptions;
		if (params.token) {
			const token = params.token;
			delete params.token;
			params.token = token;
		}
		if (requestOptions.headers?.['Content-Type'] === 'multipart/form-data') {
			await Mwbot.handlePostMultipartFormData(requestOptions);
		} else {
			// use application/x-www-form-urlencoded (default)
			// requestOptions.data = params;
			requestOptions.data = Object.entries(params)
				.map(([key, val]) => encodeURIComponent(key) + '=' + encodeURIComponent(val as string))
				.join('&');
		}
	}

	private static async handlePostMultipartFormData(requestOptions: MwbotRequestConfig): Promise<void> {
		const {params} = requestOptions;
		const form = new FormData();
		for (const [key, val] of Object.entries(params)) {
			if (val instanceof Object && 'stream' in val) {
				// TypeScript facepalm
				//@ts-expect-error Property 'name' does not exist?
				form.append(key, val.stream, val.name);
			} else {
				form.append(key, val);
			}
		}
		requestOptions.data = form;
		requestOptions.headers = await new Promise((resolve, reject) => {
			form.getLength((err, length) => {
				if (err) {
					reject(err);
				}
				resolve({
					...requestOptions.headers,
					...form.getHeaders(),
					'Content-Length': length,
				});
			});
		});
	}

	get(parameters: ApiParams, requestOptions: MwbotRequestConfig = {}): Promise<ApiResponse> {
		requestOptions.method = 'GET';
		return this.request(parameters, requestOptions);
	}

	post(parameters: ApiParams, requestOptions: MwbotRequestConfig = {}): Promise<ApiResponse> {
		requestOptions.method = 'POST';
		return this.request(parameters, requestOptions);
	}

	/**
	 * Abort all unfinished HTTP requests issued by this instance.
	 */
	abort(): void {
		this.abortions.forEach((controller) => {
			if (controller) {
				controller.abort();
			}
		});
		this.abortions = [];
	}

}

/**
 * Perform a deep merge of objects and return a new object.
 *
 * The following two things should be noted:
 * * This does not modify the passed objects, and merges arrays via concatenation.
 * * Non-plain objects are passed by reference (mutable).
 * @param objects
 * @returns
 */
function mergeDeep(...objects: any[]): Record<string, any> {
	return objects.reduce((acc: Record<string, any>, obj) => {
		if (obj === undefined || obj === null) {
			// undefined and null cannot be passed to Object.keys
			return acc;
		}
		Object.keys(obj).forEach((key) => {
			const aVal = acc[key];
			const oVal = obj[key];
			if (Array.isArray(aVal) && Array.isArray(oVal)) {
				acc[key].push(...oVal);
			} else if (isPlainObject(aVal) && isPlainObject(oVal)) {
				acc[key] = mergeDeep(aVal, oVal);
			} else {
				acc[key] = oVal;
			}
		});
		return acc;
	}, Object.create(null));
}

/**
 * Check whether an object is a plain object.
 *
 * Adapted from {@link https://github.com/sindresorhus/is-plain-obj/blob/master/index.js}.
 * @param value
 * @returns
 */
function isPlainObject(value: any): boolean {
	if (Object.prototype.toString.call(value) !== '[object Object]') {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}

function rejectWithError(error: ApiResponseError): Promise<ApiResponse> {
	return Promise.reject({error});
}

/**
 * Additional options for {@link Mwbot.rawRequest}.
 */
interface MwbotRawRequestOptions {
	/**
	 * Whether to merge `requestOptions` into {@link Mwbot.defaultRequestOptions}. This ensures that
	 * `requestOptions` contains the least options to query the MediaWiki Action API, but
	 * unnecessary options will need to be overridden manually.
	 */
	useDefaults?: boolean;
	/**
	 * Whether to merge `requestOptions` into {@link Mwbot.userRequestOptions}.
	 */
	useUserOptions?: boolean;
	/**
	 * Whether to use the cookie associated with the {@link Mwbot} instance for session handling.
	 */
	useCookie?: boolean;
}

interface MwbotRequestConfig extends AxiosRequestConfig {
	/**
	 * The maximum number of times to retry the HTTP request.
	 */
	retryNumber?: number;
	/**
	 * A predicate function that determines whether the HTTP request should be retried based on certain conditions.
	 * @param response The API response containing error details.
	 * @param failCount The number of times the HTTP request has failed so far (e.g. for the third retry, this number will be `2`).
	 * @returns A boolean indicating whether the request should be retried.
	 */
	retryPredicate?: (response: ApiResponse, failCount: number) => boolean;
	/**
	 * The minimum interval between HTTP requests, in **milliseconds**.
	 *
	 * NOTE: This will enforce an interval regardless of the request types. If you need to specify
	 * conditions, use {@link intervalPredicate}.
	 */
	interval?: number;
	/**
	 * A predicate function that determines the interval between HTTP requests based on certain conditions.
	 *
	 * For example, if you need to ensure a 5-second interval after a successful edit request:
	 * ```javascript
	 * const intervalPredicate = ({action}, lastSuccessfulRequestParams) => {
	 * 	if (lastSuccessfulRequestParams && lastSuccessfulRequestParams.action === 'edit' && action === 'edit') {
	 * 		return 5 * 1000; // 5 seconds in milliseconds
	 * 	} else {
	 * 		return 0; // No interval if the actions are different or there was no successful previous request
	 * 	}
	 * };
	 * ```
	 * @param requestParams The parameters for the current HTTP request.
	 * @param lastSuccessfulRequestParams The parameters for the previous successful HTTP request, or `null` if there was no successful request.
	 * @returns The interval in milliseconds (or `0` if no interval is needed).
	 */
	intervalPredicate?: (requestParams: ApiParams, lastSuccessfulRequestParams: ApiParams | null) => number;
}

function sleep(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}