/**
 * ip-wiki — IP Address Utility Library
 * @version 1.0.2
 * @see https://dr4goniez.github.io/ip-wiki/index.html API documentation
 * @internal
 */
//<nowiki>
/**
 * Abstract class with protected methods.
 * @abstract
 * @internal
 */
class IPBase {

	/**
	 * @param {boolean} override
	 * @throws
	 * @hidden
	 */
	constructor(override) {
		if (override !== true) {
			throw new Error('It is not allowed to create an instance of the abstract class.');
		}
	}

	/**
	 * Return a trimmed string from which all occurrences of unicode bidi characters are removed.
	 *
	 * "Unicode bidi characters" are special characters shown as red dots in WikiEditor, which can
	 * slip into cut-and-pasted strings. When we evaluate whether a string represents an IP address,
	 * these can cause serious trouble.
	 * @see MediaWikiTitleCodec::splitTitleString in MediaWiki core
	 *
	 * @param {string} str
	 * @returns {string}
	 */
	static clean(str) {
		return str.replace(/[\u200E\u200F\u202A-\u202E]+/g, '').trim();
	}

	/**
	 * Parse a string that potentially represents an IP or CIDR address.
	 * @param {string} ipStr
	 * @param {number} [bitLen] An optional bit length of the IP address.
	 * @returns {Parsed?} A parsed object, or `null` if:
	 * * `ipStr` is not a string.
	 * * `ipStr` does not represent an IP address.
	 * * `ipStr` contains an invalid bit length for a CIDR.
	 * @protected
	 */
	static parse(ipStr, bitLen) {

		if (typeof ipStr !== 'string') {
			return null;
		}
		ipStr = this.clean(ipStr);
		if (typeof bitLen === 'number') {
			ipStr = ipStr.replace(/\/\d+$/, '');
			ipStr += '/' + bitLen;
		}

		let m;
		if ((m = ipStr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/))) {
			// Potential IPv4
			/** @type {Parsed} */
			const ret = {
				parts: [],
				bitLen: typeof m[5] === 'string' ? parseInt(m[5]) : null
			};
			if (ret.bitLen !== null && !(0 <= ret.bitLen && ret.bitLen <= 32)) {
				return null;
			}
			for (let i = 1; i <= 4; i++) {
				const num = parseInt(m[i]);
				if (m[i].length <= 3 && 0 <= num && num <= 255) {
					ret.parts.push(num);
				} else {
					return null;
				}
			}
			return ret;
		} else if ((m = ipStr.match(/^([\p{Hex_Digit}:]+)(?:\/(\d+))?$/u)) && !/:::/.test(ipStr) && (ipStr.match(/::/g) || []).length < 2) {
			// Potential IPv6
			/** @type {Parsed} */
			const ret = {
				parts: [],
				bitLen: typeof m[2] === 'string' ? parseInt(m[2]) : null
			};
			if (ret.bitLen !== null && !(0 <= ret.bitLen && ret.bitLen <= 128)) {
				return null;
			}
			ipStr = m[1];
			let parts = ipStr.split(':');
			if (parts.length < 7) {
				ipStr = ipStr.replace('::', ':'.repeat(10 - parts.length));
				parts = ipStr.split(':');
			}
			if (parts.length !== 8) {
				return null;
			}
			for (const el of parts) {
				const num = el === '' ? 0 : parseInt(el, 16);
				if (el.length <= 4 && 0 <= num && num <= 0xffff) {
					ret.parts.push(num);
				} else {
					return null;
				}
			}
			return ret;
		}

		return null;

	}

	/**
	 * Get the start and end IP addresses for the range of `bitLen` as an object of arrays of decimals.
	 * @param {number[]} parts
	 * @param {number?} bitLen
	 * @returns {RangeObject}
	 * @protected
	 */
	static parseRange(parts, bitLen) {

		if (parts.length !== 4 && parts.length !== 8) {
			throw new Error(`Unexpected error: The IP has ${parts.length} parts.`);
		}
		if (typeof bitLen !== 'number') {
			return {
				first: parts,
				last: parts,
				bitLen: parts.length === 4 ? 32 : 128,
				isCidr: false
			};
		}

		// Get the netmask
		const netMaskParts =
			(
				// Convert the bit length to a 32- or 128-bit binary-representing string.
				// e.g. if the input is IPv4 and bitLen is 24, this will be `11111111 11111111 11111111 00000000`.
				// The max bit length is the square of the number of IP parts multiplied by 2:
				// 4^2*2=32 or 8^2*2=128 (where "^" here is an exponent operator, not the JS bitwise XOR)
				// If JS allowed 52-bit+ numbers, we would be able to use something like `~(1 << bitLen) >>> 0`
				// instead, but the result will cause an overflow in the case of IPv6.
				('1'.repeat(bitLen) + '0'.repeat(Math.pow(parts.length, 2) * 2 - bitLen))
				// Split the string to an array of 8- or 16-bit binary-representing strings
				.match(new RegExp(`.{${parts.length * 2}}`, 'g')) || []
			)
			// Map the binary-representing strings to decimals, e.g. [255, 255, 255, 0]
			.map(/** @param {string} bin */ (bin) => parseInt(bin, 2));

		// Get the first address
		const first = parts.map((el, i) => {
			// The first address of the netmask calculated above is the bitwise AND of the IP parts and the netmask parts
			// e.g. if the input IP string is `192.168.0.1`:
			// 192 & 255 = 192, 168 & 255 = 168, 0 & 255 = 0, 1 & 0 = 0
			return el & netMaskParts[i];
		});

		// Get the last address
		const high = parts.length === 4 ? 255 : 0xffff;
		const invNetMaskParts = netMaskParts.map((el) => el ^ high); // Inverted netmask, e.g. [0, 0, 0, 255]
		// The last address of the netmask calculated above is the bitwise OR of the first IP's parts and the inverted netmask parts
		// 192 | 0 = 192, 168 | 0 = 168, 0 | 0 = 0, 1 | 255 = 255
		const last = first.map((el, i) => el | invNetMaskParts[i]);

		// Return the result as an object of arrays of decimals
		// CAUTION: The IP parts are in decimals (must be converted to hex for IPv6)
		return {
			first,
			last,
			bitLen,
			isCidr: true
		};

	}

	/**
	 * Stringify an array of IP parts in decimals.
	 * @param {number[]} decimals
	 * @param {string} suffix
	 * @param {StringifyOptions} [options]
	 * @returns {string}
	 * @protected
	 */
	static stringify(decimals, suffix, options = {}) {
		/** @type {(number|string)[]} */
		let parts = decimals;
		const version = parts.length === 4 ? 4 : 6;
		const delimiter = version === 4 ? '.' : ':';
		const {mode, capitalize} = options;
		if (version === 6) {
			// IPv6's parts need to be converted from decimal to hex
			parts = parts.map(el => el.toString(16));
		}
		if (mode === 'short' && version === 6) {
			let ret = parts.join(delimiter) + ':'; // Temporarily add a trailing :
			const zeros = ret.match(/(?:0:){2,}/g);
			if (zeros) {
				const longest = zeros.reduce((a, b) => a.length > b.length ? a : b);
				ret = ret
					// Replace the longest recurrences of 0: with ::
					.replace(longest, '::')
					// Replace any ::: with :: produced by the replacement
					.replace(':::', '::')
					// Remove a single trailing :, if any
					.replace(/([^:]):$/, '$1');
			}
			return this.modCase(ret + suffix, capitalize);
		} else if (mode === 'long') {
			parts = parts.map((el) => {
				const str = el.toString();
				return '0'.repeat((version === 4 ? 3 : 4) - str.length) + str;
			});
		}
		return this.modCase(parts.join(delimiter) + suffix, capitalize);
	}

	/**
	 * Change the casing of a string.
	 * @param {string} str
	 * @param {boolean} [upper] Whether to capitalize the output, which defaults to `false`.
	 * @returns {string} The original string if `upper` isn't true.
	 * @protected
	 */
	static modCase(str, upper = false) {
		return upper ? str.toUpperCase() : str;
	}

	/**
	 * Parse an IP string into an array and convert back into a string.
	 * @param {string} ipStr
	 * @param {StringifyOptions} options
	 * @param {ConditionPredicate} [conditionPredicate]
	 * Optional IP address conditions to perform stringification.
	 * @returns {string?} `null` if:
	 * * The input string does not represent an IP address.
	 * * The parsed IP address does not meet the conditions specified by `conditionPredicate`
	 * @protected
	 */
	static parseAndStringify(ipStr, options, conditionPredicate) {
		let {parts, bitLen} = this.parse(ipStr) || {parts: null, bitLen: null};
		if (
			parts === null ||
			conditionPredicate && !conditionPredicate(parts.length === 4 ? 4 : 6, bitLen !== null)
		) {
			return null;
		}
		// If CIDR, correct any inaccurate ones
		parts = this.parseRange(parts, bitLen).first;
		const suffix = bitLen !== null ? '/' + bitLen : '';
		return this.stringify(parts, suffix, options);
	}

	/**
	 * Compare two ranges to check their inclusion relationship.
	 * @param {RangeObject} ip1 An object of arrays of the IP parts in decimals.
	 * @param {string|IP} ip2
	 * @param {"<"|">"} comparator Which of `ip1` and `ip2` is expected to be broader.
	 * @returns {boolean?} `null` if `ip2` does not represent an IP address.
	 * @protected
	 */
	static compareRanges(ip1, ip2, comparator) {
		const range1 = ip1;
		const range2 = this.getRangeObject(ip2);
		if (range2 === null) {
			return null;
		}
		const len = range1.first.length;
		if (![range1.last, range2.first, range2.last].every(({length}) => length === len)) {
			return false;
		}
		let broader, narrower;
		if (comparator === '<') {
			broader = range2;
			narrower = range1;
		} else if (comparator === '>') {
			broader = range1;
			narrower = range2;
		} else {
			throw new Error('Invalid comparator has been provided.');
		}
		for (let i = 0; i < len; i++) {
			if (!(broader.first[i] <= narrower.first[i] && narrower.last[i] <= broader.last[i])) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Given an IP string or instance, parse it into an object of arrays of decimals that
	 * represent the parts of the first and last IPs.
	 * @param {string|IP} ip
	 * @returns {RangeObject?} `null` if the input string does not represent an IP address.
	 * @protected
	 */
	static getRangeObject(ip) {
		if (ip instanceof IP) {
			return ip.getProperties();
		} else {
			const {parts, bitLen} = this.parse(ip) || {parts: null, bitLen: null};
			if (!parts) {
				return null;
			}
			return this.parseRange(parts, bitLen);
		}
	}

	/**
	 * Check the equality of two IP addresses.
	 * @param {RangeObject} ipObj An object of arrays of the IP parts in decimals.
	 * @param {string|IP} ipStr An IP- or CIDR-representing string, or an IP instance.
	 * @returns {boolean?} `null` if `ipStr` does not represent an IP address.
	 * @protected
	 */
	static checkEquality(ipObj, ipStr) {
		const ip1 = ipObj;
		const ip2 = this.getRangeObject(ipStr);
		if (!ip2) {
			return null;
		}
		if (ip1.first.length !== ip2.first.length || ip1.bitLen !== ip2.bitLen) {
			return false;
		} else {
			return ip1.first.every((part, i) => part === ip2.first[i]);
		}
	}

}
/**
 * The IPUtil class. Unlike the {@link IP} class, this class provides several static methods
 * that can be used to perform validations on an IP or CIDR address just once, or on varying
 * IP or CIDR addresses.
 */
class IPUtil extends IPBase {

	/**
	 * @throws
	 * @hidden
	 */
	constructor() {
		super(true);
		throw new Error('It is not allowed to create an instance of the static class.');
	}

	/**
	 * Sanitize an IP-representing string. For example:
	 * * `192.168.0.1` (for IPv4 addresses, same as {@link IPUtil.abbreviate})
	 * * `fd12:3456:789a:1:0:0:0:0`
	 *
	 * Note that inaccurate CIDRs will be corrected:
	 * * input: `fd12:3456:789a:1::1/64`
	 * * output: `fd12:3456:789a:1:0:0:0:0/64`
	 * @param {string} ipStr
	 * @param {boolean} [capitalize] Whether to capitalize the output, which defaults to `false`.
	 * @param {ConditionPredicate} [conditionPredicate]
	 * Optional IP address conditions to perform stringification.
	 * @returns {string?} `null` if:
	 * * The input string does not represent an IP address.
	 * * The parsed IP address does not meet the conditions specified by `conditionPredicate`
	 */
	static sanitize(ipStr, capitalize, conditionPredicate) {
		return this.parseAndStringify(ipStr, {capitalize: !!capitalize}, conditionPredicate);
	}

	/**
	 * Abbreviate an IP-representing string. For example:
	 * * `192.168.0.1` (for IPv4 addresses, same as {@link IPUtil.sanitize})
	 * * `fd12:3456:789a:1::`
	 *
	 * Note that inaccurate CIDRs will be corrected:
	 * * input: `fd12:3456:789a:1:0:0:0:1/64`
	 * * output: `fd12:3456:789a:1::/64`
	 * @param {string} ipStr
	 * @param {boolean} [capitalize] Whether to capitalize the output, which defaults to `false`.
	 * @param {ConditionPredicate} [conditionPredicate]
	 * Optional IP address conditions to perform stringification.
	 * @returns {string?} `null` if:
	 * * The input string does not represent an IP address.
	 * * The parsed IP address does not meet the conditions specified by `conditionPredicate`
	 */
	static abbreviate(ipStr, capitalize, conditionPredicate) {
		return this.parseAndStringify(ipStr, {mode: 'short', capitalize: !!capitalize}, conditionPredicate);
	}

	/**
	 * Lengthen an IP-representing string. For example:
	 * * `192.168.000.001`
	 * * `fd12:3456:789a:0001:0000:0000:0000:0000`
	 *
	 * Note that inaccurate CIDRs will be corrected:
	 * * input: `fd12:3456:789a:1:0:0:0:1/64`
	 * * output: `fd12:3456:789a:0001:0000:0000:0000:0000/64`
	 * @param {string} ipStr
	 * @param {boolean} [capitalize] Whether to capitalize the output, which defaults to `false`.
	 * @param {ConditionPredicate} [conditionPredicate]
	 * Optional IP address conditions to perform stringification.
	 * @returns {string?} `null` if:
	 * * The input string does not represent an IP address.
	 * * The parsed IP address does not meet the conditions specified by `conditionPredicate`
	 */
	static lengthen(ipStr, capitalize, conditionPredicate) {
		return this.parseAndStringify(ipStr, {mode: 'long', capitalize: !!capitalize}, conditionPredicate);
	}

	/**
	 * Validate a string as an IP address under certain conditions.
	 * @overload
	 * @param {string} ipStr
	 * @param {boolean} allowCidr
	 * @param {ConditionPredicate} [conditionPredicate]
	 * @returns {boolean}
	 */
	/**
	 * Validate a string as an IP address under certain conditions.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} allowCidr
	 * @param {ConditionPredicate} [conditionPredicate]
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {boolean|StrictCIDR} allowCidr
	 * @param {ConditionPredicate} [conditionPredicate]
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 * @private
	 * @internal
	 */
	static validate(ipStr, allowCidr, conditionPredicate, options) {
		const {parts, bitLen} = this.parse(ipStr) || {parts: null, bitLen: null};
		const isCidr = bitLen !== null;
		if (
			// Not a valid IP, or
			!parts ||
			// Disallowed to be CIDR but is CIDR, or
			!allowCidr && isCidr ||
			// Doesn't meet the conditions of the predicate
			conditionPredicate && !conditionPredicate(parts.length === 4 ? 4 : 6, isCidr)
		) {
			return false;
		}
		if (allowCidr === 'strict' && isCidr) {
			// On strict CIDR validation mode, return a corrected CIDR if the prefix is inaccurate
			const {first} = this.parseRange(parts, bitLen);
			if (!first.every((num, i) => num === parts[i])) {
				return this.stringify(first, '/' + bitLen, options);
			}
		}
		return true;
	}

	/**
	 * Evaluate whether a string represents an IP address.
	 * @overload
	 * @param {string} ipStr
	 * @param {boolean} [allowCidr] Whether to allow CIDRs, which defaults to `false`.
	 * @returns {boolean}
	 */
	/**
	 * Evaluate whether a string represents an IP address, with the {@link StrictCIDR|strict CIDR validation mode} on.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} allowCidr
	 * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
	 * be formatted.
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {boolean|StrictCIDR} allowCidr
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	// eslint-disable-next-line default-param-last
	static isIP(ipStr, allowCidr = false, options) {
		return typeof allowCidr === 'boolean' ?
			this.validate(ipStr, allowCidr) :
			this.validate(ipStr, allowCidr, void 0, options);
	}

	/**
	 * Evaluate whether a string represents an IPv4 address.
	 * @overload
	 * @param {string} ipStr
	 * @param {boolean} [allowCidr] Whether to allow CIDRs, which defaults to `false`.
	 * @returns {boolean}
	 */
	/**
	 * Evaluate whether a string represents an IPv4 address, with the {@link StrictCIDR|strict CIDR validation mode} on.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} allowCidr
	 * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
	 * be formatted.
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {boolean|StrictCIDR} allowCidr
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	// eslint-disable-next-line default-param-last
	static isIPv4(ipStr, allowCidr = false, options) {
		/** @type {ConditionPredicate} */
		const cond = (version) => version === 4;
		return typeof allowCidr === 'boolean' ?
			this.validate(ipStr, allowCidr, cond) :
			this.validate(ipStr, allowCidr, cond, options);
	}

	/**
	 * Evaluate whether a string represents an IPv6 address.
	 * @overload
	 * @param {string} ipStr
	 * @param {boolean} [allowCidr] Whether to allow CIDRs, which defaults to `false`.
	 * @returns {boolean}
	 */
	/**
	 * Evaluate whether a string represents an IPv6 address, with the {@link StrictCIDR|strict CIDR validation mode} on.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} allowCidr
	 * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
	 * be formatted.
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {boolean|StrictCIDR} allowCidr
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	// eslint-disable-next-line default-param-last
	static isIPv6(ipStr, allowCidr = false, options) {
		/** @type {ConditionPredicate} */
		const cond = (version) => version === 6;
		return typeof allowCidr === 'boolean' ?
			this.validate(ipStr, allowCidr, cond) :
			this.validate(ipStr, allowCidr, cond, options);
	}

	/**
	 * Evaluate whether a string represents a CIDR.
	 * @overload
	 * @param {string} ipStr
	 * @returns {boolean}
	 */
	/**
	 * Evaluate whether a string represents a CIDR, with the {@link StrictCIDR|strict CIDR validation mode} on.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} mode
	 * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
	 * be formatted.
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {StrictCIDR} [mode]
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	static isCIDR(ipStr, mode, options) {
		/** @type {ConditionPredicate} */
		const cond = (_, isCidr) => isCidr;
		return mode !== 'strict' ?
			this.validate(ipStr, true, cond) :
			this.validate(ipStr, 'strict', cond, options);
	}

	/**
	 * Evaluate whether a string represents an IPv4 CIDR.
	 * @overload
	 * @param {string} ipStr
	 * @returns {boolean}
	 */
	/**
	 * Evaluate whether a string represents an IPv4 CIDR, with the {@link StrictCIDR|strict CIDR validation mode} on.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} mode
	 * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
	 * be formatted.
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {StrictCIDR} [mode]
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	static isIPv4CIDR(ipStr, mode, options) {
		/** @type {ConditionPredicate} */
		const cond = (version, isCidr) => version === 4 && isCidr;
		return mode !== 'strict' ?
			this.validate(ipStr, true, cond) :
			this.validate(ipStr, 'strict', cond, options);
	}

	/**
	 * Evaluate whether a string represents an IPv6 CIDR.
	 * @overload
	 * @param {string} ipStr
	 * @returns {boolean}
	 */
	/**
	 * Evaluate whether a string represents an IPv6 CIDR, with the {@link StrictCIDR|strict CIDR validation mode} on.
	 * @overload
	 * @param {string} ipStr
	 * @param {StrictCIDR} mode
	 * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
	 * be formatted.
	 * @returns {boolean|string}
	 */
	/**
	 * @param {string} ipStr
	 * @param {StrictCIDR} [mode]
	 * @param {StringifyOptions} [options]
	 * @returns {boolean|string}
	 */
	static isIPv6CIDR(ipStr, mode, options) {
		/** @type {ConditionPredicate} */
		const cond = (version, isCidr) => version === 6 && isCidr;
		return mode !== 'strict' ?
			this.validate(ipStr, true, cond) :
			this.validate(ipStr, 'strict', cond, options);
	}

	/**
	 * Evaluate whether the IP address associated with `ipStr` is within that associated with `cidrStr`.
	 * @param {string|IP} ipStr
	 * @param {string|IP} cidrStr
	 * @returns {boolean?} `null` if any of the two input strings does not represent an IP address.
	 */
	static isInRange(ipStr, cidrStr) {
		const ip = this.getRangeObject(ipStr);
		if (ip === null) {
			return null;
		}
		return this.compareRanges(ip, cidrStr, '<');
	}

	/**
	 * Evaluate whether the IP address associated with `ipStr` is within any IP range
	 * in the `cidrArr` array.
	 * @param {string|IP} ipStr
	 * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {number?} The index number of the first match in the `cidrArr` array, or `-1` if there is
	 * no match. `null` will be returned if `ipStr` does not represent an IP address.
	 */
	static isInAnyRange(ipStr, cidrArr) {
		const ip = this.getRangeObject(ipStr);
		if (ip === null) {
			return null;
		}
		return cidrArr.findIndex((cidr) => !!this.compareRanges(ip, cidr, '<'));
	}

	/**
	 * Evaluate whether the IP address associated with `ipStr` is within all IP ranges
	 * in the `cidrArr` array.
	 * @param {string|IP} ipStr
	 * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {boolean?} `null` if:
	 * * `ipStr` does not represent an IP address.
	 * * `cidrArr` is not an array or an empty array.
	 */
	static isInAllRanges(ipStr, cidrArr) {
		if (!Array.isArray(cidrArr) || !cidrArr.length) {
			return null;
		}
		const ip = this.getRangeObject(ipStr);
		if (ip === null) {
			return null;
		}
		return cidrArr.every((cidr) => !!this.compareRanges(ip, cidr, '<'));
	}

	/**
	 * Evaluate whether the IP address associated with `cidrStr` contains that associated with `ipStr`.
	 * @param {string|IP} cidrStr
	 * @param {string|IP} ipStr
	 * @returns {boolean?} `null` if any of the two input strings does not represent an IP address.
	 */
	static contains(cidrStr, ipStr) {
		const cidr = this.getRangeObject(cidrStr);
		if (cidr === null) {
			return null;
		}
		return this.compareRanges(cidr, ipStr, '>');
	}

	/**
	 * Evaluate whether the IP address associated with `cidrStr` contains any IP address
	 * in the `ipArr` array.
	 * @param {string|IP} cidrStr
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {number?} The index number of the first match in the `ipArr` array, or `-1` if there is
	 * no match. `null` will be returned if `cidrStr` does not represent an IP address.
	 */
	static containsAny(cidrStr, ipArr) {
		const cidr = this.getRangeObject(cidrStr);
		if (cidr === null) {
			return null;
		}
		return ipArr.findIndex((ip) => !!this.compareRanges(cidr, ip, '>'));
	}

	/**
	 * Evaluate whether the IP address associated with `cidrStr` contains all IP addresses
	 * in the `ipArr` array.
	 * @param {string|IP} cidrStr
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {boolean?} `null` if:
	 * * `cidrStr` does not represent an IP address.
	 * * `ipArr` is not an array or an empty array.
	 */
	static containsAll(cidrStr, ipArr) {
		if (!Array.isArray(ipArr) || !ipArr.length) {
			return null;
		}
		const cidr = this.getRangeObject(cidrStr);
		if (cidr === null) {
			return null;
		}
		return ipArr.every((ip) => !!this.compareRanges(cidr, ip, '>'));
	}

	/**
	 * Evaluate whether the IP address associated with `ipStr1` equals that associated with `ipStr2`.
	 * @param {string|IP} ipStr1
	 * @param {string|IP} ipStr2
	 * @returns {boolean?} `null` if any of the two input strings does not represent an IP address.
	 */
	static equals(ipStr1, ipStr2) {
		const ip1 = this.getRangeObject(ipStr1);
		if (ip1 === null) {
			return null;
		}
		return IP.checkEquality(ip1, ipStr2);
	}

	/**
	 * Evaluate whether the IP address associated with `ipStr` equals any IP address
	 * in the `ipArr` array.
	 * @param {string|IP} ipStr
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {number?} The index number of the first match in the `ipArr` array, or `-1` if there is
	 * no match. `null` will be returned if `ipStr` does not represent an IP address.
	 */
	static equalsAny(ipStr, ipArr) {
		const ip1 = this.getRangeObject(ipStr);
		if (ip1 === null) {
			return null;
		}
		return ipArr.findIndex((ip2) => !!IP.checkEquality(ip1, ip2));
	}

	/**
	 * Evaluate whether the IP address associated with `ipStr` equals all IP addresses
	 * in the `ipArr` array.
	 * @param {string|IP} ipStr
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {boolean?} `null` if:
	 * * `ipStr` does not represent an IP address.
	 * * `ipArr` is not an array or an empty array.
	 */
	static equalsAll(ipStr, ipArr) {
		if (!Array.isArray(ipArr) || !ipArr.length) {
			return null;
		}
		const ip1 = this.getRangeObject(ipStr);
		if (ip1 === null) {
			return null;
		}
		return ipArr.every((ip2) => !!IP.checkEquality(ip1, ip2));
	}

}
/**
 * The IP class. Unlike the static {@link IPUtil} class, this class provides several instance methods
 * that can be used to perform validations on the same IP or CIDR address multiple times.
 *
 * To initialize a new instance, use {@link IP.newFromText} (or {@link IP.newFromRange}):
 * ```
 * const ip = IP.newFromText('fd12:3456:789a:1::1');
 * if (!ip) {
 * 	return;
 * }
 * console.log(ip.stringify()); // fd12:3456:789a:1:0:0:0:1
 * ```
 */
class IP extends IPBase {

	/**
	 * Initialize an IP instance from a string.
	 * @param {string} ipStr An IP- or CIDR-representing string.
	 * @returns {IP?} `null` if the input string does not represent an IP address.
	 */
	static newFromText(ipStr) {
		const {parts, bitLen} = this.parse(ipStr) || {parts: null, bitLen: null};
		if (!parts) {
			return null;
		}
		return new IP(this.parseRange(parts, bitLen));
	}

	/**
	 * Initialize an IP instance from a string and a range (aka bit length).
	 * @param {string} ipStr An IP- or CIDR-representing string. If a CIDR string is passed, the `/XX` part
	 * will be overriden by `range`.
	 * @param {number} range `0-32` for IPv4, `0-128` for IPv6.
	 * @returns {IP?} `null` if:
	 * * The input string does not represent an IP address.
	 * * The bit length specified by `range` is invalid.
	 * @throws If `range` is not a number.
	 */
	static newFromRange(ipStr, range) {
		if (typeof range !== 'number') {
			throw new TypeError('The "range" parameter for IP.newFromRange must be a number.');
		}
		const {parts, bitLen} = this.parse(ipStr, range) || {parts: null, bitLen: null};
		if (!parts || bitLen === null) { // bitLen should never be null, though
			return null;
		}
		return new IP(this.parseRange(parts, bitLen));
	}

	/**
	 * Private constructor. Use {@link IP.newFromText} instead.
	 * @param {RangeObject} range An object that stores CIDR information.
	 * @private
	 */
	constructor(range) {
		super(true);
		/**
		 * @type {number[]}
		 * @readonly
		 * @private
		 */
		this.first = range.first;
		/**
		 * @type {number[]}
		 * @readonly
		 * @private
		 */
		this.last = range.last;
		/**
		 * @type {number}
		 * @readonly
		 * @private
		 */
		this.bitLen = range.bitLen;
		/**
		 * @type {boolean}
		 * @readonly
		 * @private
		 */
		this.isCidr = range.isCidr;
	}

	/**
	 * Get a copy of the private instance properties as an object.
	 * @returns {RangeObject}
	 */
	getProperties() {
		return {
			first: this.first.slice(),
			last: this.last.slice(),
			bitLen: this.bitLen,
			isCidr: this.isCidr
		};
	}

	/**
	 * Return the IP version as a number.
	 */
	get version() {
		if (this.first.length === 4) {
			return 4;
		} else if (this.first.length === 8) {
			return 6;
		} else {
			throw new Error('The internal array of the IP instance seems to be broken.');
		}
	}

	/**
	 * Get the IP version as a string in the format of `IPvN`.
	 */
	getVersion() {
		return 'IPv' + this.version;
	}

	/**
	 * Stringify the IP instance.
	 * @param {StringifyOptions} [options] Options to specify the format of the output.
	 * If not provided, the "sanitized" format will be used.
	 * @returns {string}
	 * Note that even if the instance was initialized from an inaccurate CIDR string, the output will
	 * be in a "corrected" format:
	 * ```
	 * const ip = IP.newFromText('fd12:3456:789a:1::1/64');
	 * ip.stringify(); // fd12:3456:789a:1:0:0:0:0/64
	 * ```
	 */
	stringify(options = {}) {
		const suffix = this.isCidr ? '/' + this.bitLen : '';
		return IP.stringify(this.first, suffix, options);
	}

	/**
	 * Same as {@link IP.stringify} when it's called without options.
	 * @returns {string}
	 */
	toString() {
		return this.stringify();
	}

	/**
	 * Evaluate whether the IP address associated with the instance is an IPv4 address.
	 * @param {boolean} [allowCidr] Whether to allow a CIDR address, which defaults to false.
	 * @returns {boolean}
	 */
	isIPv4(allowCidr = false) {
		return this.version === 4 && !(!allowCidr && this.isCidr);
	}

	/**
	 * Evaluate whether the IP address associated with the instance is an IPv6 address.
	 * @param {boolean} [allowCidr] Whether to allow a CIDR address, which defaults to false.
	 * @returns {boolean}
	 */
	isIPv6(allowCidr = false) {
		return this.version === 6 && !(!allowCidr && this.isCidr);
	}

	/**
	 * Evaluate whether the IP address associated with the instance is a CIDR address.
	 * @returns {boolean}
	 */
	isCIDR() {
		return this.isCidr;
	}

	/**
	 * Evaluate whether the IP address associated with the instance is an IPv4 CIDR address.
	 * @returns {boolean}
	 */
	isIPv4CIDR() {
		return this.version === 4 && this.isCidr;
	}

	/**
	 * Evaluate whether the IP address associated with the instance is an IPv6 CIDR address.
	 * @returns {boolean}
	 */
	isIPv6CIDR() {
		return this.version === 6 && this.isCidr;
	}

	/**
	 * Get the bit length of the IP instance.
	 *
	 * Note that this always returns a number between `0-32` for IPv4 and `0-128` for IPv6.
	 * To evaluate whether the instance is a CIDR, use {@link IP.isCIDR}.
	 * @returns {number}
	 */
	getBitLength() {
		return this.bitLen;
	}

	/**
	 * Get range information of the IP instance. The return value includes:
	 * * The (forced) CIDR notation of the IP address associated with the instance.
	 * * The bit length of the CIDR as a number.
	 * * The starting IP address of the CIDR as a *string*.
	 * * The ending IP address of the CIDR as a *string*.
	 * @overload
	 * @param {false} [getObject]
	 * @param {StringifyOptions} [options]
	 * @returns {{bitLen: number; cidr: string; first: string; last: string;}}
	 */
	/**
	 * Get range information of the IP instance. The return value includes:
	 * * The (forced) CIDR notation of the IP address associated with the instance.
	 * * The bit length of the CIDR as a number.
	 * * The starting IP address of the CIDR as an *IP object*.
	 * * The ending IP address of the CIDR as an *IP object*.
	 * @overload
	 * @param {true} getObject
	 * @param {StringifyOptions} [options]
	 * @returns {{bitLen: number; cidr: string; first: IP; last: IP;}}
	 */
	/**
	 * @param {boolean} [getObject]
	 * @param {StringifyOptions} [options]
	 * @returns {{bitLen: number; cidr: string; first: string|IP; last: string|IP;}}
	 */
	getRange(getObject, options = {}) {
		let {first, last, bitLen, isCidr} = this.getProperties();
		if (!getObject) {
			const firstStr = IP.stringify(first, '', options);
			return {
				bitLen,
				cidr: firstStr + '/' + bitLen,
				first: firstStr,
				last: IP.stringify(last, '', options)
			};
		} else {
			first = first.slice();
			last = last.slice();
			const bl = first.length === 4 ? 32 : 128;
			isCidr = false;
			return {
				bitLen,
				cidr: IP.stringify(first, '/' + bitLen, options),
				first: new IP({first, last: first, bitLen: bl, isCidr}),
				last: new IP({first: last, last, bitLen: bl, isCidr})
			};
		}
	}

	/**
	 * Evaluate whether the IP address associated with this instance is within that associated with `cidrStr`.
	 * @param {string|IP} cidrStr
	 * @returns {boolean?} `null` if `cidrStr` does not represent an IP address.
	 */
	isInRange(cidrStr) {
		return IP.compareRanges(this.getProperties(), cidrStr, '<');
	}

	/**
	 * Evaluate whether the IP address associated with this instance is within any IP range
	 * in the `cidrArr` array.
	 * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {number} The index number of the first match in the `cidrArr` array, or `-1` otherwise.
	 */
	isInAnyRange(cidrArr) {
		const props = this.getProperties();
		return cidrArr.findIndex((cidr) => !!IP.compareRanges(props, cidr, '<'));
	}

	/**
	 * Evaluate whether the IP address associated with this instance is within all IP ranges
	 * in the `cidrArr` array.
	 * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {boolean?} `null` if `cidrArr` is not an array or an empty array.
	 */
	isInAllRanges(cidrArr) {
		if (!Array.isArray(cidrArr) || !cidrArr.length) {
			return null;
		}
		const props = this.getProperties();
		return cidrArr.every((cidr) => !!IP.compareRanges(props, cidr, '<'));
	}

	/**
	 * Evaluate whether the IP address associated with this instance contains that associated
	 * with `ipStr`.
	 * @param {string|IP} ipStr
	 * @returns {boolean?} `null` if `ipStr` does not represent an IP address.
	 */
	contains(ipStr) {
		return IP.compareRanges(this.getProperties(), ipStr, '>');
	}

	/**
	 * Evaluate whether the IP address associated with this instance contains any IP address
	 * in the `ipArr` array.
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {number} The index number of the first match in the `ipArr` array, or `-1` otherwise.
	 */
	containsAny(ipArr) {
		const props = this.getProperties();
		return ipArr.findIndex((ip) => !!IP.compareRanges(props, ip, '>'));
	}

	/**
	 * Evaluate whether the IP address associated with this instance contains all IP addresses
	 * in the `ipArr` array.
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {boolean?} `null` if `ipArr` is not an array or an empty array.
	 */
	containsAll(ipArr) {
		if (!Array.isArray(ipArr) || !ipArr.length) {
			return null;
		}
		const props = this.getProperties();
		return ipArr.every((ip) => !!IP.compareRanges(props, ip, '>'));
	}

	/**
	 * Evaluate whether the IP address associated with this intance equals that associated
	 * with `ipStr`.
	 * @param {string|IP} ipStr An IP- or CIDR-representing string, or an IP instance.
	 * @returns {boolean?} `null` if `ipStr` does not represent an IP address.
	 */
	equals(ipStr) {
		const props = this.getProperties();
		return IP.checkEquality(props, ipStr);
	}

	/**
	 * Evaluate whether the IP address associated with this intance equals any IP address
	 * in the `ipArr` array.
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {number} The index number of the first match in the `ranges` array, or `-1` otherwise.
	 */
	equalsAny(ipArr) {
		const props = this.getProperties();
		return ipArr.findIndex((ip) => !!IP.checkEquality(props, ip));
	}

	/**
	 * Evaluate whether the IP address associated with this intance equals all IP addresses
	 * in the `ipArr` array.
	 * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
	 * @returns {boolean?} `null` if `ipArr` is not an array or an empty array.
	 */
	equalsAll(ipArr) {
		if (!Array.isArray(ipArr) || !ipArr.length) {
			return null;
		}
		const props = this.getProperties();
		return ipArr.every((ip) => !!IP.checkEquality(props, ip));
	}

}
/**
 * @typedef {import('./IP-types.ts').Parsed} Parsed
 * @typedef {import('./IP-types.ts').RangeObject} RangeObject
 * @typedef {import('./IP-types.ts').StringifyOptions} StringifyOptions
 * @typedef {import('./IP-types.ts').StrictCIDR} StrictCIDR
 * @typedef {import('./IP-types.ts').ConditionPredicate} ConditionPredicate
 */
module.exports = {
	IPUtil,
	IP
};
//</nowiki>