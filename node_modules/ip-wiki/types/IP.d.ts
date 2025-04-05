import {
    Parsed,
    RangeObject,
    StringifyOptions,
    StrictCIDR,
    ConditionPredicate
} from './IP-types';
/**
 * The IPUtil class. Unlike the {@link IP} class, this class provides several static methods
 * that can be used to perform validations on an IP or CIDR address just once, or on varying
 * IP or CIDR addresses.
 */
export class IPUtil extends IPBase {
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
    static sanitize(ipStr: string, capitalize?: boolean | undefined, conditionPredicate?: ConditionPredicate | undefined): string | null;
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
    static abbreviate(ipStr: string, capitalize?: boolean | undefined, conditionPredicate?: ConditionPredicate | undefined): string | null;
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
    static lengthen(ipStr: string, capitalize?: boolean | undefined, conditionPredicate?: ConditionPredicate | undefined): string | null;
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
    private static validate;
    /**
     * Evaluate whether a string represents an IP address.
     * @overload
     * @param {string} ipStr
     * @param {boolean} [allowCidr] Whether to allow CIDRs, which defaults to `false`.
     * @returns {boolean}
     */
    static isIP(ipStr: string, allowCidr?: boolean | undefined): boolean;
    /**
     * Evaluate whether a string represents an IP address, with the {@link StrictCIDR|strict CIDR validation mode} on.
     * @overload
     * @param {string} ipStr
     * @param {StrictCIDR} allowCidr
     * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
     * be formatted.
     * @returns {boolean|string}
     */
    static isIP(ipStr: string, allowCidr: StrictCIDR, options?: StringifyOptions | undefined): boolean | string;
    /**
     * Evaluate whether a string represents an IPv4 address.
     * @overload
     * @param {string} ipStr
     * @param {boolean} [allowCidr] Whether to allow CIDRs, which defaults to `false`.
     * @returns {boolean}
     */
    static isIPv4(ipStr: string, allowCidr?: boolean | undefined): boolean;
    /**
     * Evaluate whether a string represents an IPv4 address, with the {@link StrictCIDR|strict CIDR validation mode} on.
     * @overload
     * @param {string} ipStr
     * @param {StrictCIDR} allowCidr
     * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
     * be formatted.
     * @returns {boolean|string}
     */
    static isIPv4(ipStr: string, allowCidr: StrictCIDR, options?: StringifyOptions | undefined): boolean | string;
    /**
     * Evaluate whether a string represents an IPv6 address.
     * @overload
     * @param {string} ipStr
     * @param {boolean} [allowCidr] Whether to allow CIDRs, which defaults to `false`.
     * @returns {boolean}
     */
    static isIPv6(ipStr: string, allowCidr?: boolean | undefined): boolean;
    /**
     * Evaluate whether a string represents an IPv6 address, with the {@link StrictCIDR|strict CIDR validation mode} on.
     * @overload
     * @param {string} ipStr
     * @param {StrictCIDR} allowCidr
     * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
     * be formatted.
     * @returns {boolean|string}
     */
    static isIPv6(ipStr: string, allowCidr: StrictCIDR, options?: StringifyOptions | undefined): boolean | string;
    /**
     * Evaluate whether a string represents a CIDR.
     * @overload
     * @param {string} ipStr
     * @returns {boolean}
     */
    static isCIDR(ipStr: string): boolean;
    /**
     * Evaluate whether a string represents a CIDR, with the {@link StrictCIDR|strict CIDR validation mode} on.
     * @overload
     * @param {string} ipStr
     * @param {StrictCIDR} mode
     * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
     * be formatted.
     * @returns {boolean|string}
     */
    static isCIDR(ipStr: string, mode: StrictCIDR, options?: StringifyOptions | undefined): boolean | string;
    /**
     * Evaluate whether a string represents an IPv4 CIDR.
     * @overload
     * @param {string} ipStr
     * @returns {boolean}
     */
    static isIPv4CIDR(ipStr: string): boolean;
    /**
     * Evaluate whether a string represents an IPv4 CIDR, with the {@link StrictCIDR|strict CIDR validation mode} on.
     * @overload
     * @param {string} ipStr
     * @param {StrictCIDR} mode
     * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
     * be formatted.
     * @returns {boolean|string}
     */
    static isIPv4CIDR(ipStr: string, mode: StrictCIDR, options?: StringifyOptions | undefined): boolean | string;
    /**
     * Evaluate whether a string represents an IPv6 CIDR.
     * @overload
     * @param {string} ipStr
     * @returns {boolean}
     */
    static isIPv6CIDR(ipStr: string): boolean;
    /**
     * Evaluate whether a string represents an IPv6 CIDR, with the {@link StrictCIDR|strict CIDR validation mode} on.
     * @overload
     * @param {string} ipStr
     * @param {StrictCIDR} mode
     * @param {StringifyOptions} [options] Optional specifications of how the output CIDR string should
     * be formatted.
     * @returns {boolean|string}
     */
    static isIPv6CIDR(ipStr: string, mode: StrictCIDR, options?: StringifyOptions | undefined): boolean | string;
    /**
     * Evaluate whether the IP address associated with `ipStr` is within that associated with `cidrStr`.
     * @param {string|IP} ipStr
     * @param {string|IP} cidrStr
     * @returns {boolean?} `null` if any of the two input strings does not represent an IP address.
     */
    static isInRange(ipStr: string | IP, cidrStr: string | IP): boolean | null;
    /**
     * Evaluate whether the IP address associated with `ipStr` is within any IP range
     * in the `cidrArr` array.
     * @param {string|IP} ipStr
     * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {number?} The index number of the first match in the `cidrArr` array, or `-1` if there is
     * no match. `null` will be returned if `ipStr` does not represent an IP address.
     */
    static isInAnyRange(ipStr: string | IP, cidrArr: (string | IP)[]): number | null;
    /**
     * Evaluate whether the IP address associated with `ipStr` is within all IP ranges
     * in the `cidrArr` array.
     * @param {string|IP} ipStr
     * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {boolean?} `null` if:
     * * `ipStr` does not represent an IP address.
     * * `cidrArr` is not an array or an empty array.
     */
    static isInAllRanges(ipStr: string | IP, cidrArr: (string | IP)[]): boolean | null;
    /**
     * Evaluate whether the IP address associated with `cidrStr` contains that associated with `ipStr`.
     * @param {string|IP} cidrStr
     * @param {string|IP} ipStr
     * @returns {boolean?} `null` if any of the two input strings does not represent an IP address.
     */
    static contains(cidrStr: string | IP, ipStr: string | IP): boolean | null;
    /**
     * Evaluate whether the IP address associated with `cidrStr` contains any IP address
     * in the `ipArr` array.
     * @param {string|IP} cidrStr
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {number?} The index number of the first match in the `ipArr` array, or `-1` if there is
     * no match. `null` will be returned if `cidrStr` does not represent an IP address.
     */
    static containsAny(cidrStr: string | IP, ipArr: (string | IP)[]): number | null;
    /**
     * Evaluate whether the IP address associated with `cidrStr` contains all IP addresses
     * in the `ipArr` array.
     * @param {string|IP} cidrStr
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {boolean?} `null` if:
     * * `cidrStr` does not represent an IP address.
     * * `ipArr` is not an array or an empty array.
     */
    static containsAll(cidrStr: string | IP, ipArr: (string | IP)[]): boolean | null;
    /**
     * Evaluate whether the IP address associated with `ipStr1` equals that associated with `ipStr2`.
     * @param {string|IP} ipStr1
     * @param {string|IP} ipStr2
     * @returns {boolean?} `null` if any of the two input strings does not represent an IP address.
     */
    static equals(ipStr1: string | IP, ipStr2: string | IP): boolean | null;
    /**
     * Evaluate whether the IP address associated with `ipStr` equals any IP address
     * in the `ipArr` array.
     * @param {string|IP} ipStr
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {number?} The index number of the first match in the `ipArr` array, or `-1` if there is
     * no match. `null` will be returned if `ipStr` does not represent an IP address.
     */
    static equalsAny(ipStr: string | IP, ipArr: (string | IP)[]): number | null;
    /**
     * Evaluate whether the IP address associated with `ipStr` equals all IP addresses
     * in the `ipArr` array.
     * @param {string|IP} ipStr
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {boolean?} `null` if:
     * * `ipStr` does not represent an IP address.
     * * `ipArr` is not an array or an empty array.
     */
    static equalsAll(ipStr: string | IP, ipArr: (string | IP)[]): boolean | null;
    /**
     * @throws
     * @hidden
     */
    constructor();
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
export class IP extends IPBase {
    /**
     * Initialize an IP instance from a string.
     * @param {string} ipStr An IP- or CIDR-representing string.
     * @returns {IP?} `null` if the input string does not represent an IP address.
     */
    static newFromText(ipStr: string): IP | null;
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
    static newFromRange(ipStr: string, range: number): IP | null;
    /**
     * Private constructor. Use {@link IP.newFromText} instead.
     * @param {RangeObject} range An object that stores CIDR information.
     * @private
     */
    private constructor();
    /**
     * @type {number[]}
     * @readonly
     * @private
     */
    private readonly first;
    /**
     * @type {number[]}
     * @readonly
     * @private
     */
    private readonly last;
    /**
     * @type {number}
     * @readonly
     * @private
     */
    private readonly bitLen;
    /**
     * @type {boolean}
     * @readonly
     * @private
     */
    private readonly isCidr;
    /**
     * Get a copy of the private instance properties as an object.
     * @returns {RangeObject}
     */
    getProperties(): RangeObject;
    /**
     * Return the IP version as a number.
     */
    get version(): 4 | 6;
    /**
     * Get the IP version as a string in the format of `IPvN`.
     */
    getVersion(): string;
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
    stringify(options?: StringifyOptions | undefined): string;
    /**
     * Evaluate whether the IP address associated with the instance is an IPv4 address.
     * @param {boolean} [allowCidr] Whether to allow a CIDR address, which defaults to false.
     * @returns {boolean}
     */
    isIPv4(allowCidr?: boolean | undefined): boolean;
    /**
     * Evaluate whether the IP address associated with the instance is an IPv6 address.
     * @param {boolean} [allowCidr] Whether to allow a CIDR address, which defaults to false.
     * @returns {boolean}
     */
    isIPv6(allowCidr?: boolean | undefined): boolean;
    /**
     * Evaluate whether the IP address associated with the instance is a CIDR address.
     * @returns {boolean}
     */
    isCIDR(): boolean;
    /**
     * Evaluate whether the IP address associated with the instance is an IPv4 CIDR address.
     * @returns {boolean}
     */
    isIPv4CIDR(): boolean;
    /**
     * Evaluate whether the IP address associated with the instance is an IPv6 CIDR address.
     * @returns {boolean}
     */
    isIPv6CIDR(): boolean;
    /**
     * Get the bit length of the IP instance.
     *
     * Note that this always returns a number between `0-32` for IPv4 and `0-128` for IPv6.
     * To evaluate whether the instance is a CIDR, use {@link IP.isCIDR}.
     * @returns {number}
     */
    getBitLength(): number;
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
    getRange(getObject?: false | undefined, options?: StringifyOptions | undefined): {
        bitLen: number;
        cidr: string;
        first: string;
        last: string;
    };
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
    getRange(getObject: true, options?: StringifyOptions | undefined): {
        bitLen: number;
        cidr: string;
        first: IP;
        last: IP;
    };
    /**
     * Evaluate whether the IP address associated with this instance is within that associated with `cidrStr`.
     * @param {string|IP} cidrStr
     * @returns {boolean?} `null` if `cidrStr` does not represent an IP address.
     */
    isInRange(cidrStr: string | IP): boolean | null;
    /**
     * Evaluate whether the IP address associated with this instance is within any IP range
     * in the `cidrArr` array.
     * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {number} The index number of the first match in the `cidrArr` array, or `-1` otherwise.
     */
    isInAnyRange(cidrArr: (string | IP)[]): number;
    /**
     * Evaluate whether the IP address associated with this instance is within all IP ranges
     * in the `cidrArr` array.
     * @param {(string|IP)[]} cidrArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {boolean?} `null` if `cidrArr` is not an array or an empty array.
     */
    isInAllRanges(cidrArr: (string | IP)[]): boolean | null;
    /**
     * Evaluate whether the IP address associated with this instance contains that associated
     * with `ipStr`.
     * @param {string|IP} ipStr
     * @returns {boolean?} `null` if `ipStr` does not represent an IP address.
     */
    contains(ipStr: string | IP): boolean | null;
    /**
     * Evaluate whether the IP address associated with this instance contains any IP address
     * in the `ipArr` array.
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {number} The index number of the first match in the `ipArr` array, or `-1` otherwise.
     */
    containsAny(ipArr: (string | IP)[]): number;
    /**
     * Evaluate whether the IP address associated with this instance contains all IP addresses
     * in the `ipArr` array.
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {boolean?} `null` if `ipArr` is not an array or an empty array.
     */
    containsAll(ipArr: (string | IP)[]): boolean | null;
    /**
     * Evaluate whether the IP address associated with this intance equals that associated
     * with `ipStr`.
     * @param {string|IP} ipStr An IP- or CIDR-representing string, or an IP instance.
     * @returns {boolean?} `null` if `ipStr` does not represent an IP address.
     */
    equals(ipStr: string | IP): boolean | null;
    /**
     * Evaluate whether the IP address associated with this intance equals any IP address
     * in the `ipArr` array.
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {number} The index number of the first match in the `ranges` array, or `-1` otherwise.
     */
    equalsAny(ipArr: (string | IP)[]): number;
    /**
     * Evaluate whether the IP address associated with this intance equals all IP addresses
     * in the `ipArr` array.
     * @param {(string|IP)[]} ipArr An array of IP- or CIDR-representing strings or IP instances.
     * @returns {boolean?} `null` if `ipArr` is not an array or an empty array.
     */
    equalsAll(ipArr: (string | IP)[]): boolean | null;
}
/**
 * ip-wiki — IP Address Utility Library
 * @version 1.0.2
 * @see https://dr4goniez.github.io/ip-wiki/index.html API documentation
 * @internal
 */
/**
 * Abstract class with protected methods.
 * @abstract
 * @internal
 */
declare class IPBase {
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
    static clean(str: string): string;
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
    protected static parse(ipStr: string, bitLen?: number | undefined): Parsed | null;
    /**
     * Get the start and end IP addresses for the range of `bitLen` as an object of arrays of decimals.
     * @param {number[]} parts
     * @param {number?} bitLen
     * @returns {RangeObject}
     * @protected
     */
    protected static parseRange(parts: number[], bitLen: number | null): RangeObject;
    /**
     * Stringify an array of IP parts in decimals.
     * @param {number[]} decimals
     * @param {string} suffix
     * @param {StringifyOptions} [options]
     * @returns {string}
     * @protected
     */
    protected static stringify(decimals: number[], suffix: string, options?: StringifyOptions | undefined): string;
    /**
     * Change the casing of a string.
     * @param {string} str
     * @param {boolean} [upper] Whether to capitalize the output, which defaults to `false`.
     * @returns {string} The original string if `upper` isn't true.
     * @protected
     */
    protected static modCase(str: string, upper?: boolean | undefined): string;
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
    protected static parseAndStringify(ipStr: string, options: StringifyOptions, conditionPredicate?: ConditionPredicate | undefined): string | null;
    /**
     * Compare two ranges to check their inclusion relationship.
     * @param {RangeObject} ip1 An object of arrays of the IP parts in decimals.
     * @param {string|IP} ip2
     * @param {"<"|">"} comparator Which of `ip1` and `ip2` is expected to be broader.
     * @returns {boolean?} `null` if `ip2` does not represent an IP address.
     * @protected
     */
    protected static compareRanges(ip1: RangeObject, ip2: string | IP, comparator: "<" | ">"): boolean | null;
    /**
     * Given an IP string or instance, parse it into an object of arrays of decimals that
     * represent the parts of the first and last IPs.
     * @param {string|IP} ip
     * @returns {RangeObject?} `null` if the input string does not represent an IP address.
     * @protected
     */
    protected static getRangeObject(ip: string | IP): RangeObject | null;
    /**
     * Check the equality of two IP addresses.
     * @param {RangeObject} ipObj An object of arrays of the IP parts in decimals.
     * @param {string|IP} ipStr An IP- or CIDR-representing string, or an IP instance.
     * @returns {boolean?} `null` if `ipStr` does not represent an IP address.
     * @protected
     */
    protected static checkEquality(ipObj: RangeObject, ipStr: string | IP): boolean | null;
    /**
     * @param {boolean} override
     * @throws
     * @hidden
     */
    constructor(override: boolean);
}
export {};
