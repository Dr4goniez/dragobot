"use strict";
/**
 * This module is largely adapted from mediawiki-core.
 * @link https://doc.wikimedia.org/mediawiki-core/master/js/source/Title.html
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNamespacePrefix = exports.isKnownNamespace = exports.getNsIdsByType = exports.getNsIdByName = exports.Title = exports.rUnicodeBidi = void 0;
const string_1 = require("./string");
const phpCharToUpper_1 = require("./phpCharToUpper");
/**
 * Gives a mapping from namespace names to namespace IDs. For each namespace name, including localized and canonical names as well as aliases,
 * the object has one entry that has namespace name as the key and the namespace ID as its integer value. The keys are all lowercase, with spaces
 * replaced by underscores.
 */
const wgNamespaceIds = {
    'メディア': -2,
    '特別': -1,
    '': 0,
    'ノート': 1,
    '利用者': 2,
    '利用者‐会話': 3,
    'wikipedia': 4,
    'wikipedia‐ノート': 5,
    'ファイル': 6,
    'ファイル‐ノート': 7,
    'mediawiki': 8,
    'mediawiki‐ノート': 9,
    'template': 10,
    'template‐ノート': 11,
    'help': 12,
    'help‐ノート': 13,
    'category': 14,
    'category‐ノート': 15,
    'portal': 100,
    'portal‐ノート': 101,
    'プロジェクト': 102,
    'プロジェクト‐ノート': 103,
    'timedtext': 710,
    'timedtext_talk': 711,
    'モジュール': 828,
    'モジュール‐ノート': 829,
    'gadget': 2300,
    'gadget_talk': 2301,
    'gadget_definition': 2302,
    'gadget_definition_talk': 2303,
    'トーク': 1,
    '利用者・トーク': 3,
    'wikipedia・トーク': 5,
    'ファイル・トーク': 7,
    'mediawiki・トーク': 9,
    'テンプレート': 10,
    'テンプレート・トーク': 11,
    'ヘルプ': 12,
    'ヘルプ・トーク': 13,
    'カテゴリ': 14,
    'カテゴリ・トーク': 15,
    'ポータル‐ノート': 101,
    'portal・トーク': 101,
    'プロジェクト・トーク': 103,
    'モジュール・トーク': 829,
    'wikipedia_talk': 5,
    'wp': 4,
    '画像': 6,
    '画像‐ノート': 7,
    'image': 6,
    'image_talk': 7,
    'media': -2,
    'special': -1,
    'talk': 1,
    'user': 2,
    'user_talk': 3,
    'project': 4,
    'project_talk': 5,
    'file': 6,
    'file_talk': 7,
    'mediawiki_talk': 9,
    'template_talk': 11,
    'help_talk': 13,
    'category_talk': 15,
    'module': 828,
    'module_talk': 829
};
const nsMain = wgNamespaceIds[''];
const nsTalk = wgNamespaceIds.talk;
const nsSpecial = wgNamespaceIds.special;
const nsMedia = wgNamespaceIds.media;
const nsFile = wgNamespaceIds.file;
/**
 * Gives a mapping from namespace IDs to localized namespace names. For each namespace, the object has one entry that has the stringified
 * namespace number as the key and the namespace name as its value. Aliases or canonical names are not included.
 */
const wgFormattedNamespaces = {
    '0': '',
    '1': 'ノート',
    '2': '利用者',
    '3': '利用者‐会話',
    '4': 'Wikipedia',
    '5': 'Wikipedia‐ノート',
    '6': 'ファイル',
    '7': 'ファイル‐ノート',
    '8': 'MediaWiki',
    '9': 'MediaWiki‐ノート',
    '10': 'Template',
    '11': 'Template‐ノート',
    '12': 'Help',
    '13': 'Help‐ノート',
    '14': 'Category',
    '15': 'Category‐ノート',
    '100': 'Portal',
    '101': 'Portal‐ノート',
    '102': 'プロジェクト',
    '103': 'プロジェクト‐ノート',
    '710': 'TimedText',
    '711': 'TimedText talk',
    '828': 'モジュール',
    '829': 'モジュール‐ノート',
    '2300': 'Gadget',
    '2301': 'Gadget talk',
    '2302': 'Gadget definition',
    '2303': 'Gadget definition talk',
    '-2': 'メディア',
    '-1': '特別'
};
/**
 * The IDs of the namespaces treated as case-sensitive by MediaWiki.
 */
const wgCaseSensitiveNamespaces = [2300, 2301, 2302, 2303];
/**
 * The IDs of the namespaces in which signature buttons should be shown, in addition to talk namespaces.
 */
const wgExtraSignatureNamespaces = [4, 12];
/** RegExp (global flag) to trim leading/trailing underscores. */
const rUnderscoreTrim = /^_+|_+$/g;
/**
 * RegExp to split a pagetitle to a prefix and a title.
 * $1: prefix (without a colon)
 * $2: title
 */
const rSplit = /^(.+?)_*:_*(.*)$/;
/** RegExp to find characters that can't be used for the titles of page on Wikimedia sites. */
const rInvalid = new RegExp(
// mw.config.get('wgLegalTitleChars')
'[^ %!"$&\'()*,\\-./0-9:;=?@A-Z\\\\\\^_`a-z~+\\u0080-\\uFFFF]' +
    // URL percent encoding sequences interfere with the ability
    // to round-trip titles -- you can't link to them consistently.
    '|%[\\dA-Fa-f]{2}' +
    // XML/HTML character references produce similar issues.
    '|&[\\dA-Za-z\u0080-\uFFFF]+;');
/**
 * RegExp (global flag) to remove whitespaces (from MediaWikiTitleCodec::splitTitleString() in PHP).
 * Note that this is not equivalent to /\s/, e.g. underscore is included, tab is not included.
 */
const rWhitespace = /[_\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;
/**
 * RegExp (global flag) to remove unicode-bidirectional characters (from MediaWikiTitleCodec::splitTitleString() in PHP).
 */
exports.rUnicodeBidi = /[\u200E\u200F\u202A-\u202E]+/g;
const sanitationRules = [
    // "signature"
    {
        pattern: /~{3}/g,
        replace: '',
        generalRule: true
    },
    // control characters
    {
        // eslint-disable-next-line no-control-regex
        pattern: /[\x00-\x1f\x7f]/g,
        replace: '',
        generalRule: true
    },
    // URL encoding (possibly)
    {
        pattern: /%([\dA-Fa-f]{2})/g,
        replace: '% $1',
        generalRule: true
    },
    // HTML-character-entities
    {
        pattern: /&(([\dA-Za-z\x80-\xff]+|#\d+|#x[\dA-Fa-f]+);)/g,
        replace: '& $1',
        generalRule: true
    },
    // slash, colon (not supported by file systems like NTFS/Windows, Mac OS 9 [:], ext4 [/])
    {
        pattern: /[:/\\\\]/g,
        replace: '-',
        fileRule: true
    },
    // brackets, greater than
    {
        pattern: /[}\]>]/g,
        replace: ')',
        generalRule: true
    },
    // brackets, lower than
    {
        pattern: /[{[<]/g,
        replace: '(',
        generalRule: true
    },
    // everything that wasn't covered yet
    {
        pattern: new RegExp(rInvalid.source, 'g'),
        replace: '-',
        generalRule: true
    },
    // directory structures
    {
        pattern: /^(\.|\.\.|\.\/.*|\.\.\/.*|.*\/\.\/.*|.*\/\.\.\/.*|.*\/\.|.*\/\.\.)$/g,
        replace: '',
        generalRule: true
    }
];
const titleMaxBytes = 255;
const fileMaxBytes = 240;
class Title {
    /**
     * @param title Title of the page. If no second argument given, this will be searched for a namespace.
     * @param namespace If given, will be used as default namespace for the given title.
     * @param parsed Private parameter. Do not pass a value to this parameter manually.
     * @throws {Error} When the title is invalid.
     */
    constructor(title, namespace, parsed) {
        /**
        * Alias of Title#getPrefixedDb
        */
        this.toString = this.getPrefixedDb;
        /**
        * Alias of Title#getPrefixedText
        */
        this.toText = this.getPrefixedText;
        const p = parsed || Title.parse(title, namespace);
        if (!p) {
            throw new Error('Unable to parse title');
        }
        this.title = p.title;
        this.namespace = p.namespace;
        this.fragment = p.fragment;
    }
    // ****************************** STATIC MEMBERS ******************************
    /**
     * Parse a title string, evaluate its validity, and identify a title, namespace number, and fragment.
     * @param title
     * @param ns
     * @returns
     */
    static parse(title, ns) {
        let namespace = ns === undefined ? nsMain : ns;
        title = title
            // Strip Unicode bidi override characters
            .replace(exports.rUnicodeBidi, '')
            // Normalise whitespace to underscores and remove duplicates
            .replace(rWhitespace, '_')
            // Trim underscores
            .replace(rUnderscoreTrim, '');
        if (title.indexOf('\uFFFD') !== -1) {
            // Contained illegal UTF-8 sequences or forbidden Unicode chars.
            // Commonly occurs when the text was obtained using the `URL` API, and the 'title' parameter
            // was using a legacy 8-bit encoding, for example:
            // new URL('https://en.wikipedia.org/w/index.php?title=Apollo%96Soyuz').searchParams.get('title')
            return null;
        }
        // Process initial colon
        if (title !== '' && title[0] === ':') {
            namespace = nsMain; // Initial colon means main namespace instead of specified default
            title = title.slice(1).replace(rUnderscoreTrim, '');
        }
        if (title === '') {
            return null;
        }
        // Process namespace prefix (if any)
        let m = title.match(rSplit);
        if (m) {
            const id = getNsIdByName(m[1]);
            if (id !== null) {
                namespace = id;
                title = m[2];
                // For Talk:X pages, make sure X has no namespace prefix
                if (namespace === nsTalk && (m = title.match(rSplit))) {
                    // Disallow titles like Talk:File:x (subject should roundtrip: talk:file:x -> file:x -> file_talk:x)
                    if (getNsIdByName(m[1]) !== null) {
                        return null;
                    }
                }
            }
        }
        // Process fragment
        const i = title.indexOf('#');
        let fragment;
        if (i === -1) {
            fragment = null;
        }
        else {
            fragment = title
                // Get segment starting after the hash
                .slice(i + 1)
                // Convert to text
                // NB: Must not be trimmed ("Example#_foo" is not the same as "Example#foo")
                .replace(/_/g, ' ');
            title = title
                // Strip hash
                .slice(0, i)
                // Trim underscores, again (strips "_" from "bar" in "Foo_bar_#quux")
                .replace(rUnderscoreTrim, '');
        }
        // Reject illegal characters
        if (rInvalid.test(title)) {
            return null;
        }
        // Disallow titles that browsers or servers might resolve as directory navigation
        if (title.indexOf('.') !== -1 && (title === '.' || title === '..' ||
            title.indexOf('./') === 0 ||
            title.indexOf('../') === 0 ||
            title.indexOf('/./') !== -1 ||
            title.indexOf('/../') !== -1 ||
            title.slice(-2) === '/.' ||
            title.slice(-3) === '/..')) {
            return null;
        }
        // Disallow magic tilde sequence
        if (title.indexOf('~~~') !== -1) {
            return null;
        }
        // Disallow titles exceeding the byte size limit, except for special pages, e.g. [[Special:Block/Long name]]
        if (namespace !== nsSpecial && (0, string_1.byteLength)(title) > titleMaxBytes) {
            return null;
        }
        // Can't make a link to a namespace alone.
        if (title === '' && namespace !== nsMain) {
            return null;
        }
        // Any remaining initial :s are illegal.
        if (title[0] === ':') {
            return null;
        }
        return { namespace, title, fragment };
    }
    /**
     * Constructor for Title objects with a null return instead of an exception for invalid titles.
     *
     * Note that `namespace` is the **default** namespace only, and can be overridden by a namespace
     * prefix in `title`. If you do not want this behavior, use #makeTitle. See #constructor for
     * details.
     */
    static newFromText(title, namespace) {
        const parsed = Title.parse(title, namespace);
        if (!parsed) {
            return null;
        }
        return new Title(title, namespace, parsed);
    }
    /**
     * Constructor for Title objects with predefined namespace.
     *
     * Unlike #newFromText or #constructor, this function doesn't allow the given `namespace` to be
     * overridden by a namespace prefix in `title`. See #constructor for details about this behavior.
     *
     * The single exception to this is when `namespace` is 0, indicating the main namespace. The
     * function behaves like #newFromText in that case.
     *
     * @param namespace Namespace to use for the title
     * @param title
     * @return A valid Title object or null if the title is invalid
     */
    static makeTitle(namespace, title) {
        if (!isKnownNamespace(namespace)) {
            return null;
        }
        else {
            return Title.newFromText(getNamespacePrefix(namespace) + title);
        }
    }
    /**
     * Constructor for Title objects from user input altering that input to
     * produce a title that MediaWiki will accept as legal
     *
     * @param title
     * @param namespace If given, will used as default namespace for the given title.
     * @param options additional options
     * @param options.forUploading
     *	Makes sure that a file is uploadable under the title returned.
     *	There are pages in the file namespace under which file upload is impossible.
     *	Automatically assumed if the title is created in the Media namespace.
     * @returns A valid Title object or null if the input cannot be turned into a valid title
     */
    static newFromUserInput(title, namespace, options) {
        namespace = namespace === undefined ? nsMain : namespace;
        // Merge options into defaults
        options = Object.assign({
            forUploading: true
        }, options);
        // Normalise additional whitespace
        title = title.replace(/\s/g, ' ').trim();
        // Process initial colon
        if (title !== '' && title[0] === ':') {
            namespace = nsMain; // Initial colon means main namespace instead of specified default
            title = title.slice(1).replace(rUnderscoreTrim, '');
        }
        // Process namespace prefix (if any)
        const m = title.match(rSplit);
        if (m) {
            const id = getNsIdByName(m[1]);
            if (id !== null) {
                namespace = id;
                title = m[2];
            }
        }
        if (namespace === nsMedia || options.forUploading && namespace === nsFile) {
            title = sanitize(title, ['generalRule', 'fileRule']);
            // Operate on the file extension
            // Although it is possible having spaces between the name and the ".ext" this isn't nice for
            // operating systems hiding file extensions -> strip them later on
            const lastDot = title.lastIndexOf('.');
            // No or empty file extension
            if (lastDot === -1 || lastDot >= title.length - 1) {
                return null;
            }
            // Get the last part, which is supposed to be the file extension
            const ext = title.slice(lastDot + 1);
            // Remove whitespace of the name part (that without extension)
            title = title.slice(0, lastDot).trim();
            // Cut, if too long and append file extension
            title = trimFileNameToByteLength(title, ext);
        }
        else {
            title = sanitize(title, ['generalRule']);
            // Cut titles exceeding the TITLE_MAX_BYTES byte size limit
            // (size of underlying database field)
            if (namespace !== nsSpecial) {
                title = trimToByteLength(title, titleMaxBytes);
            }
        }
        // Any remaining initial :s are illegal.
        title = title.replace(/^:+/, '');
        return Title.newFromText(title, namespace);
    }
    /**
     * Sanitizes a file name as supplied by the user, originating in the user's file system
     * so it is most likely a valid MediaWiki title and file name after processing.
     * Returns null on fatal errors.
     *
     * @param uncleanName The unclean file name including file extension but without namespace
     * @return A valid Title object or null if the title is invalid
     */
    static newFromFileName(uncleanName) {
        return Title.newFromUserInput('File:' + uncleanName);
    }
    // /**
    //  * Get the file title from an image element
    //  *
    //  *	var title = mw.Title.newFromImg(imageNode);
    //  *
    //  * @static
    //  * @param {HTMLElement|jQuery} img The image to use as a base
    //  * @return {mw.Title|null} The file title or null if unsuccessful
    //  */
    // static newFromImg(img: HTMLImageElement/*|cheerio.Root*/): Title|null {
    // 	const src = img.cheerio ? img[0].src : img.src;
    // 	const data = mw.util.parseImageUrl(src);
    // 	return data ? Title.newFromText('File:' + data.name) : null;
    // }
    /**
     * Check if a given namespace is a talk namespace
     */
    static isTalkNamespace(namespace) {
        return !!(namespace > nsMain && namespace % 2);
    }
    /**
     * Check if signature buttons should be shown in a given namespace
     *
     * See NamespaceInfo::wantSignatures in PHP
     *
     * @param namespace Namespace ID
     * @returns Namespace is a signature namespace
     */
    static wantSignaturesNamespace(namespace) {
        return Title.isTalkNamespace(namespace) || wgExtraSignatureNamespaces.includes(namespace);
    }
    /**
     * Whether this title exists on the wiki.
     *
     * @param title prefixed db-key name (string) or instance of Title
     * @return Boolean if the information is available, otherwise null
     */
    static exists(title) {
        let match;
        const obj = Title.exist.pages;
        if (typeof title === 'string') {
            match = obj[title];
        }
        else {
            match = obj[title.toString()];
        }
        if (typeof match !== 'boolean') {
            return null;
        }
        return match;
    }
    /**
     * Normalize a file extension to the common form, making it lowercase and checking some synonyms,
     * and ensure it's clean. Extensions with non-alphanumeric characters will be discarded.
     * Keep in sync with File::normalizeExtension() in PHP.
     *
     * @param extension File extension (without the leading dot)
     * @return File extension in canonical form
     */
    static normalizeExtension(extension) {
        const lower = extension.toLowerCase();
        const normalizations = {
            htm: 'html',
            jpeg: 'jpg',
            mpeg: 'mpg',
            tiff: 'tif',
            ogv: 'ogg'
        };
        if (Object.hasOwnProperty.call(normalizations, lower)) {
            return normalizations[lower];
        }
        else if (/^[\da-z]+$/.test(lower)) {
            return lower;
        }
        else {
            return '';
        }
    }
    /**
     * PHP's strtoupper differs from String.toUpperCase in a number of cases (T147646).
     *
     * @param chr Unicode character
     * @return Unicode character, in upper case, according to the same rules as in PHP
     */
    static phpCharToUpper(chr) {
        if (phpCharToUpper_1.toUpperMap[chr] === 0) {
            // Optimisation: When the override is to keep the character unchanged,
            // we use 0 in JSON. This reduces the data by 50%.
            return chr;
        }
        return phpCharToUpper_1.toUpperMap[chr] || chr.toUpperCase();
    }
    // ****************************** PUBLIC MEMBERS ******************************
    /**
     * Get the namespace number.
     *
     * Example: 6 for "File:Example_image.svg".
     */
    getNamespaceId() {
        return this.namespace;
    }
    /**
     * Get the namespace prefix (in the content language), with all spaces replaced with underscores.
     *
     * Example: "File:" for "File:Example_image.svg".
     * In #nsMain this is '', otherwise namespace name plus ':'
     */
    getNamespacePrefix() {
        return getNamespacePrefix(this.namespace);
    }
    /**
     * Get the page name as if it is a file name, without extension or namespace prefix, in the canonical form with
     * underscores instead of spaces. For example, the title "File:Example_image.svg" will be returned as "Example_image".
     *
     * Note that this method will work for non-file titles but probably give nonsensical results.
     * A title like "User:Dr._J._Fail" will be returned as "Dr._J"! Use #getMain instead.
     */
    getFileNameWithoutExtension() {
        const ext = this.getExtension();
        if (ext === null) {
            return this.getMain();
        }
        return this.getMain().slice(0, -ext.length - 1);
    }
    /**
     * Get the page name as if it is a file name, without extension or namespace prefix, in the human-readable form with
     * spaces instead of underscores. For example, the title "File:Example_image.svg" will be returned as "Example image".
     *
     * Note that this method will work for non-file titles but probably give nonsensical results.
     * A title like "User:Dr._J._Fail" will be returned as "Dr. J"! Use #getMainText instead.
     */
    getFileNameTextWithoutExtension() {
        return text(this.getFileNameWithoutExtension());
    }
    /**
     * Get the extension of the page name (if any)
     *
     * @return Name extension or null if there is none
     */
    getExtension() {
        const lastDot = this.title.lastIndexOf('.');
        if (lastDot === -1) {
            return null;
        }
        return this.title.slice(lastDot + 1) || null;
    }
    /**
     * Get the main page name
     *
     * Example: "Example_image.svg" for "File:Example_image.svg".
     *
     * @param withFragment Include the fragment, if any
     */
    getMain(withFragment = false) {
        if (wgCaseSensitiveNamespaces.includes(this.namespace) || !this.title.length) {
            return this.title + this.getConcatableFragment(!withFragment);
        }
        const firstChar = (0, string_1.charAt)(this.title, 0);
        return Title.phpCharToUpper(firstChar) + this.title.slice(firstChar.length) + this.getConcatableFragment(!withFragment);
    }
    /**
     * Get the main page name (transformed by #text)
     *
     * Example: "Example image.svg" for "File:Example_image.svg".
     *
     * @param withFragment Include the fragment, if any
     */
    getMainText(withFragment = false) {
        return text(this.getMain() + this.getConcatableFragment(!withFragment));
    }
    /**
     * Get the full page name
     *
     * Example: "File:Example_image.svg".
     * Most useful for API calls, anything that must identify the "title".
     *
     * @param withFragment Include the fragment, if any
     */
    getPrefixedDb(withFragment = false) {
        return this.getNamespacePrefix() + this.getMain() + this.getConcatableFragment(!withFragment);
    }
    /**
     * Get the full page name (transformed by #text)
     *
     * Example: "File:Example image.svg" for "File:Example_image.svg".
     *
     * @param withFragment Include the fragment, if any
     */
    getPrefixedText(withFragment = false) {
        return text(this.getPrefixedDb() + this.getConcatableFragment(!withFragment));
    }
    /**
    * Get the page name relative to a namespace
    *
    * Example:
    *
    * - "Foo:Bar" relative to the Foo namespace becomes "Bar".
    * - "Bar" relative to any non-main namespace becomes ":Bar".
    * - "Foo:Bar" relative to any namespace other than Foo stays "Foo:Bar".
    *
    * @param namespace The namespace to be relative to
    * @param withFragment Include the fragment, if any
    */
    getRelativeText(namespace, withFragment = false) {
        if (this.getNamespaceId() === namespace) {
            return this.getMainText() + this.getConcatableFragment(!withFragment);
        }
        else if (this.getNamespaceId() === nsMain) {
            return ':' + this.getPrefixedText() + this.getConcatableFragment(!withFragment);
        }
        else {
            return this.getPrefixedText() + this.getConcatableFragment(!withFragment);
        }
    }
    /**
    * Get the fragment (if any).
    *
    * Note that this method (by design) does not include the hash character and
    * the value is not url encoded.
    */
    getFragment() {
        return this.fragment;
    }
    /**
     * Get the fragment, prefixed by '#'. If 'getFragment' is null, returns an empty string.
     *
     * @param noreturn Forcibly returns an empty string if true.
     * @original
     */
    getConcatableFragment(noreturn = false) {
        return this.fragment && !noreturn ? '#' + this.fragment : '';
    }
    // /**
    //  * Get the URL to this title
    //  *
    //  * @see mw.util#getUrl
    //  * @param {Object} [params] A mapping of query parameter names to values,
    //  *     e.g. `{ action: 'edit' }`.
    //  * @return {string}
    //  */
    // getUrl: function (params) {
    //     var fragment = this.getFragment();
    //     if (fragment) {
    //         return mw.util.getUrl(this.toString() + '#' + fragment, params);
    //     } else {
    //         return mw.util.getUrl(this.toString(), params);
    //     }
    // }
    /**
    * Check if the title is in a talk namespace
    */
    isTalkPage() {
        return Title.isTalkNamespace(this.getNamespaceId());
    }
    /**
    * Get the title for the associated talk page
    *
    * @returns The title for the associated talk page, null if not available
    */
    getTalkPage() {
        if (!this.canHaveTalkPage()) {
            return null;
        }
        return this.isTalkPage() ?
            this :
            Title.makeTitle(this.getNamespaceId() + 1, this.getMainText());
    }
    /**
    * Get the title for the subject page of a talk page
    *
    * @returns The title for the subject page of a talk page, null if not available
    */
    getSubjectPage() {
        return this.isTalkPage() ?
            Title.makeTitle(this.getNamespaceId() - 1, this.getMainText()) :
            this;
    }
    /**
    * Check the title can have an associated talk page
    */
    canHaveTalkPage() {
        return this.getNamespaceId() >= nsMain;
    }
    /**
    * Whether this title exists on the wiki.
    */
    exists() {
        return Title.exists(this);
    }
    /**
    * Check pagetitle equality.
    * @original
    */
    equals(title) {
        const t = typeof title === 'string' ? Title.newFromText(title) : title;
        return t === null ? false : this.toString() === t.toString();
    }
    /**
    * Check pagetitle equality to any of the passed titles.
    * @original
    */
    equalsToAny(titles) {
        return titles.some((title) => {
            const t = typeof title === 'string' ? Title.newFromText(title) : title;
            return t === null ? false : this.toString() === t.toString();
        });
    }
    /**
    * Check pagetitle equality to all of the passed titles.
    * @original
    */
    equalsToAll(titles) {
        return titles.every((title) => {
            const t = typeof title === 'string' ? Title.newFromText(title) : title;
            return t === null ? false : this.toString() === t.toString();
        });
    }
}
exports.Title = Title;
/**
 * Store page existence
 */
Title.exist = {
    pages: {},
    set: (titles, state = true) => {
        titles = Array.isArray(titles) ? titles : [titles];
        for (let i = 0, len = titles.length; i < len; i++) {
            Title.exist.pages[titles[i]] = state;
        }
        return true;
    }
};
/**
 * Get the namespace id from a namespace alias.
 * @param alias Exact match. Spaces are automatically replaced with underscores.
 */
function getNsIdByName(alias) {
    return wgNamespaceIds[alias.toLowerCase().replace(/ /g, '_')] || null;
}
exports.getNsIdByName = getNsIdByName;
/**
 * Get namespace IDs by type.
 * @param type `main` or `talk`.
 * @returns An array of namespace IDs.
 */
function getNsIdsByType(type) {
    return Object.keys(wgFormattedNamespaces).reduce((acc, ns) => {
        const num = parseInt(ns);
        if (num >= nsMain && (type === 'main' ? !(num % 2) : !!(num % 2))) {
            acc.push(num);
        }
        return acc;
    }, []);
}
exports.getNsIdsByType = getNsIdsByType;
/**
 * Check whether a namespace number has its corresponding alias.
 */
function isKnownNamespace(namespace) {
    return namespace === nsMain || wgFormattedNamespaces[namespace] !== undefined;
}
exports.isKnownNamespace = isKnownNamespace;
/**
 * Get a namespace prefix from a valid namespace number.
 * @param namespace Must be valid and known. Callers should call `isKnownNamespace` before executing this function.
 * @returns An empty string for the main namespace, or else `X:` with all spaces replaced with underscores.
 */
function getNamespacePrefix(namespace) {
    return namespace === nsMain ? '' : wgFormattedNamespaces[namespace].replace(/ /g, '_') + ':';
}
exports.getNamespacePrefix = getNamespacePrefix;
/**
 * Convert db-key to readable text (replace all underscores with spaces).
 */
function text(string) {
    return string.replace(/_/g, ' ');
}
/**
 * Sanitizes a string based on a rule set and a filter
 */
function sanitize(s, filter) {
    const rules = sanitationRules;
    for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];
        for (let m = 0; m < filter.length; ++m) {
            if (Object.hasOwnProperty.call(rule, filter[m])) {
                s = s.replace(rule.pattern, rule.replace);
            }
        }
    }
    return s;
}
/**
 * Cuts a string to a specific byte length, assuming UTF-8 or less, if the last character is a multi-byte one
 */
function trimToByteLength(s, length) {
    return (0, string_1.trimByteLength)('', s, length).newVal;
}
/**
 * Cuts a file name to a specific byte length
 *
 * @method trimFileNameToByteLength
 * @param name without extension
 * @param extension file extension
 * @return The full name, including extension
 */
function trimFileNameToByteLength(name, extension) {
    // There is a special byte limit for file names and ... remember the dot
    return trimToByteLength(name, fileMaxBytes - extension.length - 1) + '.' + extension;
}
