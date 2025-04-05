/**
 * The return type of `IPBase.parse`.
 */
export interface Parsed {
    /**
     * Parts of the IP as an array of decimals.
     */
    parts: number[];
    /**
     * The bit length if the parsed address is a CIDR.
     */
    bitLen: number | null;
}
/**
 * The architecture of the internal private properties of an instance of the {@link IP} class
 * (where a copy of the properties can be obtained by {@link IP#getProperties}).
 *
 * This object stores the parsing result of the original IP string, forcibly interpreted as a
 * CIDR address. The "forcible interpretation" stands for the internal conversion of any IP
 * address into a CIDR address, e.g. `192.168.0.1` -> `192.168.0.1/32`, stored as arrays of
 * decimals with a bit length. The `isCidr` property remembers whether the original string
 * really was a CIDR.
 */
export interface RangeObject {
    /**
     * An array of decimals that represent the first IP of the CIDR address.
     */
    first: number[];
    /**
     * An array of decimals that represent the last IP of the CIDR address.
     */
    last: number[];
    /**
     * The bit length of the CIDR address.
     */
    bitLen: number;
    /**
     * `false` if the original address was not a CIDR.
     */
    isCidr: boolean;
}
/**
 * Options for how IP addresses should be formatted in the output.
 */
export interface StringifyOptions {
    /**
     * `undefined`: Return the IP address in its "sanitized" notation. For example:
     * * `192.168.0.1` (for IPv4 addresses, same as `mode: 'short'`)
     * * `fd12:3456:789a:1:0:0:0:0`
     *
     * `'short'`: Return the IP address in its shortest notation. For example:
     * * `192.168.0.1` (for IPv4 addresses, same as `mode: undefined`)
     * * `fd12:3456:789a:1::`
     *
     * `'long'`: Return the IP address in its longest notation, with each bit chunk padded with `0`.
     * For example:
     * * `192.168.000.001`
     * * `fd12:3456:789a:0001:0000:0000:0000:0000`
     */
    mode?: "short" | "long";
    /**
     * Whether to capitalize the output IP address.
     */
    capitalize?: boolean;
}
/**
 * The strict CIDR validation mode checks whether the input string is a genuinely valid CIDR,
 * ruling out unmatching prefixes. For example, the (potential) CIDR `192.168.0.1/24` is
 * inaccurate in that the prefix `192.168.0.1` should instead be `192.168.0.0` for the bit
 * length of `24`.
 *
 * Without the validation mode on, `IPUtil.isIP('192.168.0.1/24', true)` still returns `true`. But
 * with it on, the relevant method will return a corrected CIDR as a string instead of a boolean
 * if the input string is potentially valid as a CIDR but is inaccurate:
 * ```
 * // allowCidr: false or undefined
 * console.log(IPUtil.isIP('192.168.0.1')); // true
 * console.log(IPUtil.isIP('192.168.0.1/24')); // false
 * // allowCidr: true
 * console.log(IPUtil.isIP('192.168.0.1', true)); // true
 * console.log(IPUtil.isIP('192.168.0.1/24', true)); // true
 * console.log(IPUtil.isIP('192.168.0.0/24', true)); // true
 * // allowCidr: 'strict'
 * console.log(IPUtil.isIP('192.168.0.1', 'strict')); // true (just as when allowCidr is true)
 * console.log(IPUtil.isIP('192.168.0.1/24', 'strict')); // 192.168.0.0/24
 * console.log(IPUtil.isIP('192.168.0.0/24', 'strict')); // true
 * ```
 */
export type StrictCIDR = "strict";
/**
 * The type of the optional callback function to filter out IP addresses that do not
 * match the condition(s) specified by this predicate.
 * @param version By default, both IPv4 and IPv6 addresses are acknowledged.
 * @param isCidr By default, both CIDRs and non-CIDRs are acknowledged.
 * @returns
 */
export type ConditionPredicate = (version: 4 | 6, isCidr: boolean) => boolean;
