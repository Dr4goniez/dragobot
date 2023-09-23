"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Template_instances, _a, _Template_createTagRegex, _Template_registerArgFragment, _Template_originalText, _Template_index, _Template_hierarchy, _Template_newFromParsed, _Template_registerArgs, _Template_registerArg, _Template_getHier;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
const server_1 = require("./server");
const lib_1 = require("./lib");
const title_1 = require("./title");
const string_1 = require("./string");
class Template {
    /**
     * Parse {{{parameter}}}s in a wikitext.
     *
     * @param wikitext Input wikitext.
     * @param config Optional object to specify tags inside which parameters should (not) be parsed.
     */
    static parseParametersInWikitext(wikitext, config) {
        config = config || {};
        // Temporarily replace tags that prevent transclusions with `$TAGn`
        let content = wikitext;
        const regex = config._tagRegex || __classPrivateFieldGet(Template, _a, "m", _Template_createTagRegex).call(Template, config);
        const tags = [];
        if (regex.closedTag) {
            let i = 0;
            content = content.replace(new RegExp(regex.closedTag.source.replace(/^\^/, ''), 'ig'), (m) => {
                tags.push(m);
                return `$TAG${i++}$`;
            });
        }
        if (regex.closedTag) {
            content = content.replace(new RegExp(regex.closedTag.source.replace(/^\^/, ''), 'i'), '');
        }
        // Parse parameters from the left to the right
        const params = [];
        let exe;
        while ((exe = /\{\{\{[^{][^}]*\}\}\}/.exec(content))) {
            /**
             * Parameters can have templates nested (e.g. `{{{1|{{{page|{{PAGENAME}}}}}}}}`), and the `exec` above
             * gets `{{{1|{{{page|{{PAGENAME}}}` in such cases.
             */
            let para = exe[0];
            const leftBraceCnt = (para.match(/\{{2,}/g) || []).join('').length;
            let rightBraceCnt = (para.match(/\}{2,}/g) || []).join('').length;
            let grammatical = true;
            if (leftBraceCnt > rightBraceCnt) { // If the numbers of left and right braces aren't the same
                grammatical = false;
                let pos = exe.index + para.length - 3; // Get the position of `{{{1|{{{page|{{PAGENAME` in `content`
                rightBraceCnt -= 3;
                for (pos; pos < content.length; pos++) { // Check what character comes at `_` in `{{{1|{{{page|{{PAGENAME_`
                    const m = content.slice(pos).match(/^\}{2,}/);
                    if (m) { // `_` is a right brace followed by another
                        if (leftBraceCnt <= rightBraceCnt + m[0].length) { // If the right braces close all the left braces
                            para = content.slice(exe.index, pos + (leftBraceCnt - rightBraceCnt)); // Get the correct parameter
                            grammatical = true;
                            break;
                        }
                        else {
                            pos += m[0].length - 1;
                            rightBraceCnt += m[0].length;
                        }
                    }
                }
            }
            content = content.slice(content.indexOf(para) + para.length);
            if (grammatical) {
                params.push(para);
            }
            else {
                (0, server_1.log)(`Unparsable parameter: ${para}`);
            }
        }
        // Get tags back
        params.forEach((para, i) => {
            params[i] = para.replace(/\$TAG\d+\$/g, (m) => {
                const n = m.match(/(\d+)\$$/);
                const idx = parseInt(n[1]);
                return tags[idx];
            });
        });
        return params;
    }
    /**
     * Parse {{template}}s in a wikitext.
     *
     * @param wikitext Input wikitext.
     * @param config Optional object to specify parsing rules.
     */
    static parseWikitext(wikitext, config) {
        let ret = [];
        if (!/\{\{|\}\}/.test(wikitext)) {
            return ret;
        }
        const cfg = {
            includeTags: [],
            excludeTags: []
        };
        Object.assign(cfg, config || {});
        // Create tag regex
        const regex = __classPrivateFieldGet(Template, _a, "m", _Template_createTagRegex).call(Template, { includeTags: cfg.includeTags, excludeTags: cfg.excludeTags });
        // Parse {{{parameter}}}s
        const para = Template.parseParametersInWikitext(wikitext, { _tagRegex: regex });
        let numUnclosed = 0;
        let startIdx = 0;
        let args = [];
        // Character-by-character loop
        for (let i = 0; i < wikitext.length; i++) {
            const wkt = wikitext.slice(i);
            // Skip certain expressions
            let m;
            if (para[0] && wkt.indexOf(para[0]) === 0) { // Parameter
                i += para[0].length - 1;
                if (numUnclosed !== 0)
                    __classPrivateFieldGet(Template, _a, "m", _Template_registerArgFragment).call(Template, args, para[0], { nonname: true });
                para.shift();
                continue;
            }
            else if (regex.closedTag && (m = wkt.match(regex.closedTag))) { // Transclusion-preventing tags (could be self-closing)
                i += m[0].length - 1;
                if (numUnclosed !== 0)
                    __classPrivateFieldGet(Template, _a, "m", _Template_registerArgFragment).call(Template, args, m[0], { nonname: true });
                continue;
            }
            else if (regex.openTag && (m = wkt.match(regex.openTag))) { // Open tags
                break;
            }
            else if ((m = wkt.match(/^\[\[.*?\]\]/))) { // Wikilink
                i += m[0].length - 1;
                if (numUnclosed !== 0)
                    __classPrivateFieldGet(Template, _a, "m", _Template_registerArgFragment).call(Template, args, m[0], { nonname: true });
                continue;
            }
            if (numUnclosed === 0) { // We are not in a template
                if (/^\{\{/.test(wkt)) { // Found the start of a template
                    startIdx = i;
                    args = [];
                    numUnclosed += 2;
                    i++;
                }
            }
            else if (numUnclosed === 2) { // We are looking for closing braces
                if (/^\{\{/.test(wkt)) { // Found a nested template
                    numUnclosed += 2;
                    i++;
                    __classPrivateFieldGet(Template, _a, "m", _Template_registerArgFragment).call(Template, args, '{{');
                }
                else if (/^\}\}/.test(wkt)) { // Found the end of the template
                    const name = args[0] ? args[0].name : '';
                    const fullname = args[0] ? args[0].text : '';
                    const endIdx = i + 2;
                    const text = wikitext.slice(startIdx, endIdx);
                    const parsed = { name, fullname, args: args.slice(1), text, startIndex: startIdx, endIndex: endIdx, hierarchy: cfg.hierarchy };
                    const t = __classPrivateFieldGet(Template, _a, "m", _Template_newFromParsed).call(Template, parsed);
                    if (t) {
                        if (!cfg.namePredicate || cfg.namePredicate(t.getName('clean'))) {
                            if (!cfg.templatePredicate || cfg.templatePredicate(t)) {
                                ret.push(t);
                            }
                        }
                    }
                    if (!cfg.recursivePredicate || cfg.recursivePredicate(t)) {
                        const inner = text.slice(2, -2);
                        if (/\{\{/.test(inner) && /\}\}/.test(inner)) {
                            ret = ret.concat(this.parseWikitext(inner));
                        }
                    }
                    numUnclosed -= 2;
                    i++;
                }
                else { // Just part of the template
                    __classPrivateFieldGet(Template, _a, "m", _Template_registerArgFragment).call(Template, args, wkt[0], wkt[0] === '|' ? { new: true } : {});
                }
            }
            else { // We are in a nested template
                let fragment;
                if (/^\{\{/.test(wkt)) { // Found another nested template
                    fragment = '{{';
                    numUnclosed += 2;
                    i++;
                }
                else if (/^\}\}/.test(wkt)) { // Found the end of the nested template
                    fragment = '}}';
                    numUnclosed -= 2;
                    i++;
                }
                else { // Just part of the nested template
                    fragment = wkt[0];
                }
                __classPrivateFieldGet(Template, _a, "m", _Template_registerArgFragment).call(Template, args, fragment);
            }
        }
        return ret;
    }
    /**
     * Initialize a new `Template` instance.
     *
     * @param name Name of the page that is to be transcluded. Should not contain anything but a page title.
     * @param options Optional initializer object.
     * @throws When `options.fullname` does not contain `name` as a substring.
     */
    constructor(name, options) {
        _Template_instances.add(this);
        /**
         * Original text fetched by `parseWikitext`.
         */
        _Template_originalText.set(this, void 0);
        /**
         * Start and end indexes fetched by `parseWikitext`.
         */
        _Template_index.set(this, void 0);
        /**
         * Argument hierarchies.
         */
        _Template_hierarchy.set(this, void 0);
        options = options || {};
        this.name = (0, lib_1.clean)(name);
        if (this.name.includes('\n')) {
            throw new Error(`name ("${name}") is not allowed to contain inline "\\n" characters.`);
        }
        this.fullName = (0, lib_1.clean)(options.fullname || name, false);
        this.args = [];
        this.keys = [];
        this.overriddenArgs = [];
        if (!this.fullName.includes(this.name)) {
            throw new Error(`fullname ("${this.fullName}") does not contain name ("${this.name}") as a substring.`);
        }
        __classPrivateFieldSet(this, _Template_originalText, null, "f");
        __classPrivateFieldSet(this, _Template_index, {
            start: null,
            end: null
        }, "f");
        __classPrivateFieldSet(this, _Template_hierarchy, options.hierarchy || [], "f");
        // Truncate the leading colon, if any
        let colon = '';
        name = name.replace(/^[^\S\r\n]*:[^\S\r\n]*/, (m) => {
            colon = m;
            return '';
        });
        // Set cleanName
        const title = title_1.Title.newFromText(name);
        if (!title) {
            this.cleanName = colon + (0, string_1.ucFirst)(name);
        }
        else if (title.getNamespaceId() === 10) {
            this.cleanName = title.getMain(true);
        }
        else if (title.getNamespaceId() === 0) {
            this.cleanName = colon.trim() + title.getMain(true);
        }
        else {
            this.cleanName = title.getPrefixedDb(true);
        }
        this.fullCleanName = this.fullName.replace(this.name, this.cleanName);
    }
    /**
     * Get the name of the template.
     *
     * @param prop By default, returns `name` passed to #constructor.
     * - If `full` is passed, returns `fullname` passed to #constructor (same as `name` if none was passed).
     * - If `clean` is passed, returns the formatted name.
     * - If `fullclean` is passed, returns the formatted name pushed into `fullname`.
     *
     * In specifying any of the above, the first letter is capitalized.
     *
     * Note that if `name` is prefixed by `Template:`, the namespace prefix is truncated in `prop=clean` and `prop=fullclean`.
     * ```
     * // name: Template:test
     * const template = new Template('Template:test');
     * console.log(template.getName()): // Template:test
     * console.log(template.getName('full')): // Template:test
     * console.log(template.getName('clean')): // Test
     * console.log(template.getName('fullclean')): // Test
     * ```
     * For the clean names, namespace aliases are formatted to their canonical ones.
     * ```
     * // name: project:test', fullname: '<!--change?-->project:test
     * const template = new Template('project:test', '<!--change?-->project:test');
     * console.log(template.getName()): // project:test
     * console.log(template.getName('full')): // <!--change?-->project:test
     * console.log(template.getName('clean')): // Wikipedia:Test
     * console.log(template.getName('fullclean')): // <!--change?-->Wikipedia:Test
     * ```
     */
    getName(prop) {
        if (!prop) {
            return this.name;
        }
        else if (prop === 'fullclean') {
            return this.fullCleanName;
        }
        else if (prop === 'full') {
            return this.fullName;
        }
        else {
            return this.cleanName;
        }
    }
    /**
     * Add new arguments to the `Template` instance. This method leaves a log when argument override takes place,
     * which can be viewed by `getOverriddenArgs`.
     *
     * @param newArgs An array of `{name: string; value: string;}` objects.
     */
    addArgs(newArgs) {
        __classPrivateFieldGet(this, _Template_instances, "m", _Template_registerArgs).call(this, newArgs, true);
    }
    /**
     * Add a new argument to the `Template` instance. This method leaves a log when argument override takes place,
     * which can be viewed by `getOverriddenArgs`.
     *
     * Both the `name` and `value` parameters can have leading/trailing spaces, for an output wikitext of e.g.
     * `| 1 = value ` instead of `|1=value`.
     *
     * @param name An empty string may be passed for automatic argument numbering.
     * @param value A `\n` character may follow when the argument should have a linebreak before the next argument or `}}`.
     */
    addArg(name, value) {
        __classPrivateFieldGet(this, _Template_instances, "m", _Template_registerArgs).call(this, [{ name, value }], true);
    }
    /**
     * Add template arguments from a raw text (e.g. `|1=v1|2=v2`).
     *
     * @param argText String starting with a pipe character ("|").
     * @throws When `argText` does not start with a pipe character.
     */
    addArgsFromText(argText) {
        if (argText[0] !== '|') {
            throw new Error(`String passed to addArgsFromText must start with a pipe character (input: "${argText}")`);
        }
        const tmpl = Template.parseWikitext('{{' + argText + '}}', { recursivePredicate: () => false })[0];
        for (let i = 0; i < tmpl.overriddenArgs.length; i++) {
            const oArg = tmpl.overriddenArgs[i];
            this.overriddenArgs.push(oArg);
        }
        for (let i = 0; i < tmpl.args.length; i++) {
            __classPrivateFieldGet(this, _Template_instances, "m", _Template_registerArg).call(this, tmpl.args[i], true);
        }
    }
    /**
     * Set (or update) arguments in(to) the `Template` instance. This method does not leave a log when argument override takes place.
     *
     * Note: New arguments are simply newly added, just as when `addArgs` is used.
     *
     * @param newArgs An array of `{name: string; value: string;}` objects.
     */
    setArgs(newArgs) {
        __classPrivateFieldGet(this, _Template_instances, "m", _Template_registerArgs).call(this, newArgs, false);
    }
    /**
     * Set (or update) an argument in(to) the `Template` instance. This method does not leave a log when argument override takes place.
     *
     * @param name An empty string may be passed for automatic argument numbering.
     * @param value A `\n` character may follow when the argument should have a linebreak before the next argument or `}}`.
     */
    setArg(name, value) {
        __classPrivateFieldGet(this, _Template_instances, "m", _Template_registerArgs).call(this, [{ name, value }], false);
    }
    /**
     * Get template arguments as an array of objects. The array is passed by reference, meaning that modifying it will change the
     * original array stored in the `Template` instance. To prevent this, make a deep copy using `Array.prototype.slice`.
     */
    getArgs() {
        return this.args;
    }
    /**
     * Get an argument value as an object, from an argument name.
     * @param name Argument name.
     * @param options Optional search options.
     * @returns `null` if no argument is found with the specified name.
     */
    getArg(name, options) {
        options = options || {};
        const nameRegex = typeof name === 'string' ? new RegExp(`^${(0, lib_1.escapeRegExp)(name)}$`) : name;
        let firstMatch = null;
        let lastMatch = null;
        for (let i = 0; i < this.args.length; i++) {
            const arg = this.args[i];
            if (nameRegex.test(arg.name) && (!options.conditionPredicate || options.conditionPredicate(arg))) {
                if (!firstMatch) {
                    firstMatch = arg;
                }
                lastMatch = arg;
            }
        }
        let ret = options.findFirst ? firstMatch : lastMatch;
        if (ret)
            ret = Object.assign({}, ret);
        return ret;
    }
    /**
     * Check whether the `Template` instance has an argument with a certain name.
     * @param name Name of the argument to search.
     * @param options Optional search options.
     * @returns A boolean value in accordance with whether there is a match.
     */
    hasArg(name, options) {
        options = options || {};
        const nameRegex = typeof name === 'string' ? new RegExp(`^${(0, lib_1.escapeRegExp)(name)}$`) : name;
        for (let i = 0; i < this.args.length; i++) {
            const arg = this.args[i];
            if (nameRegex.test(arg.name) && (!options.conditionPredicate || options.conditionPredicate(arg))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Delete template arguments.
     * @param names
     * @returns Deleted arguments.
     */
    deleteArgs(names) {
        return names.reduce((acc, name) => {
            const idx = this.keys.indexOf(name);
            if (idx !== -1) {
                acc.push(this.args[idx]);
                this.keys.splice(idx, 1);
                this.args.splice(idx, 1);
            }
            return acc;
        }, []);
    }
    /**
     * Delete a template argument.
     * @param name
     * @returns true if an element in the `args` existed and has been removed, or false if the element does not exist.
     */
    deleteArg(name) {
        let deleted = false;
        const idx = this.keys.indexOf(name);
        if (idx !== -1) {
            this.keys.splice(idx, 1);
            this.args.splice(idx, 1);
            deleted = true;
        }
        return deleted;
    }
    /**
     * Get a list of overridden template arguments as an array of objects. This method returns a deep copy,
     * and modifying the return value does not modify the original array stored in the class.
     */
    getOverriddenArgs() {
        return this.overriddenArgs.slice();
    }
    /**
     * Render the `Template` instance as wikitext.
     *
     * If you need the raw wikitext found by `parseWikitext`, use `renderOriginal`. Note that `toString` or
     * `render({nameprop: 'full', unformatted: true})` returns a similar result, except that these two methods
     * do not render duplicate arguments, unlike `renderOriginal`.
     *
     * @param options Optional object of rendering specifications
     */
    render(options) {
        options = options || {};
        let ret = '{{';
        // Render name
        let n;
        const subst = options.subst ? 'subst:' : '';
        switch (options.nameprop) {
            case 'full':
                n = this.fullName.replace(this.name, subst + this.name);
                break;
            case 'clean':
                n = subst + this.cleanName;
                break;
            case 'fullclean':
                n = this.fullCleanName.replace(this.cleanName, subst + this.cleanName);
                break;
            default:
                n = subst + this.name;
        }
        if (options.linebreakPredicate) {
            ret += n + (options.linebreakPredicate.name(n) ? '\n' : '');
        }
        else if (options.linebreak) {
            ret += n.replace(/\n+$/, '') + '\n';
        }
        else {
            ret += n;
        }
        // Render args
        const args = this.args.slice();
        if (options.sortPredicate) {
            args.sort(options.sortPredicate);
        }
        for (const obj of args) {
            const el = options.unformatted ? obj.uftext : obj.text;
            if (options.linebreakPredicate) {
                ret += el + (options.linebreakPredicate.args(obj) ? '\n' : '');
            }
            else if (options.linebreak) {
                ret += el.replace(/\n+$/, '') + '\n';
            }
            else {
                ret += el;
            }
        }
        ret += '}}';
        return ret;
    }
    /**
     * Render the original template text.
     * @returns `string` only when the instance is created by `parseWikitext`, or else `null`.
     */
    renderOriginal() {
        return __classPrivateFieldGet(this, _Template_originalText, "f");
    }
    /**
     * Find the original template in a wikitext and replace it with the (updated) template. This method works only when
     * the instance was created by `parseWikitext`.
     * @param wikitext Wikitext in which to search for the original template.
     * @param options Optional template rendering options.
     * @returns New wikitext with the original template replaced.
     */
    replace(wikitext, options) {
        options = options || {};
        const useIndex = !!options.useIndex;
        const replacer = typeof options.replacer === 'string' ? options.replacer : this.render(options);
        if (typeof __classPrivateFieldGet(this, _Template_originalText, "f") === 'string') {
            if (!useIndex) {
                return wikitext.replace(__classPrivateFieldGet(this, _Template_originalText, "f"), replacer);
            }
            else if (wikitext.slice(__classPrivateFieldGet(this, _Template_index, "f").start, __classPrivateFieldGet(this, _Template_index, "f").end) === __classPrivateFieldGet(this, _Template_originalText, "f")) {
                let chunk1 = wikitext.slice(0, __classPrivateFieldGet(this, _Template_index, "f").start);
                const chunk2 = replacer;
                let chunk3 = wikitext.slice(__classPrivateFieldGet(this, _Template_index, "f").end);
                const hasLineBreak = /\n[^\S\n\r]*$/.test(chunk1) || /^[^\S\n\r]*\n[^\S\n\r]*/.test(chunk3);
                if (replacer === '' && hasLineBreak) {
                    chunk1 = chunk1.trim();
                    chunk3 = (chunk1 !== '' ? '\n' : '') + chunk3.trim();
                }
                return chunk1 + chunk2 + chunk3;
            }
        }
        return wikitext;
    }
    /**
     * Stringify the `Template` instance. Same as `render({nameprop: 'full', unformatted: true})`.
     */
    toString() {
        return this.render({ nameprop: 'full', unformatted: true });
    }
    /**
     * Get class properties in a JSON format.
     */
    toJSON() {
        return {
            name: this.name,
            fullName: this.fullName,
            cleanName: this.cleanName,
            fullCleanName: this.fullCleanName,
            args: this.args.slice(),
            overriddenArgs: this.overriddenArgs.slice()
        };
    }
}
exports.Template = Template;
_a = Template, _Template_originalText = new WeakMap(), _Template_index = new WeakMap(), _Template_hierarchy = new WeakMap(), _Template_instances = new WeakSet(), _Template_createTagRegex = function _Template_createTagRegex(config) {
    const cfg = {
        includeTags: [],
        excludeTags: []
    };
    Object.assign(cfg, config || {});
    const regex = {
        closedTag: null,
        openTag: null
    };
    let unparseComments = false;
    const tags = ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source', 'math']
        .filter(name => !cfg.includeTags || !cfg.includeTags.includes(name))
        .concat(cfg.excludeTags || [])
        .filter((tag, i, arr) => {
        if (tag === 'comment')
            unparseComments = true;
        return tag !== 'comment' && arr.indexOf(tag) === i;
    });
    if (tags.length || unparseComments) {
        // /^(?:<(nowiki|pre|syntaxhighlight|source|math)[^>]*?(?:\/>|>[\s\S]*?<\/\1>)|<!--[\s\S]*?-->)/
        let patterns = [
            tags.length ? `<(${tags.join('|')})[^>]*?(?:\\/>|>[\\s\\S]*?<\\/\\1>)` : null,
            unparseComments ? '<!--[\\s\\S]*?-->' : null
        ].filter(el => el);
        regex.closedTag = new RegExp(`^(?:${patterns.join('|')})`, 'i');
        // /^(?:<(nowiki|pre|syntaxhighlight|source|math)[^>]*?>|<!--)[\s\S]*$/
        patterns = [
            tags.length ? `<(${tags.join('|')})[^>]*?>` : null,
            unparseComments ? '<!--' : null
        ].filter(el => el);
        regex.openTag = new RegExp(`^(?:${patterns.join('|')})[\\s\\S]*$`, 'i');
    }
    return regex;
}, _Template_registerArgFragment = function _Template_registerArgFragment(args, fragment, options) {
    options = options || {};
    const len = options.new ? args.length : Math.max(args.length - 1, 0);
    if (args[len] === undefined) {
        args[len] = { text: '', name: '', value: '' };
    }
    let frIdx;
    if (len === 0 && options.nonname) { // Looking for a template name but the fragment is an unusual expression
        args[len].text += fragment;
    }
    else if (len === 0) { // Looking for a template name and the fragment is part of the name
        args[len].text += fragment;
        args[len].name += fragment;
    }
    else if ((frIdx = fragment.indexOf('=')) !== -1 && !args[len].name && !options.nonname) { // Found `=` when `name` is empty 
        args[len].name = args[len].text + fragment.slice(0, frIdx);
        args[len].text += fragment;
        args[len].value = args[len].text.slice(args[len].name.length + 1);
    }
    else {
        args[len].text += fragment;
        args[len].value += fragment;
    }
}, _Template_newFromParsed = function _Template_newFromParsed(parsed) {
    const { name, fullname, args, text, startIndex, endIndex, hierarchy } = parsed;
    let t = null;
    try {
        t = new Template(name, { fullname, hierarchy });
    }
    catch {
        return t;
    }
    t.addArgs(args.map((obj) => ({ 'name': obj.name.replace(/^\|/, ''), value: obj.value })));
    __classPrivateFieldSet(t, _Template_originalText, text, "f");
    __classPrivateFieldSet(t, _Template_index, {
        start: startIndex,
        end: endIndex
    }, "f");
    return t;
}, _Template_registerArgs = function _Template_registerArgs(newArgs, logOverride) {
    newArgs.forEach(({ name, value }) => {
        const ufname = name;
        const ufvalue = value;
        name = (0, lib_1.clean)(name);
        const unnamed = !name;
        if (unnamed) {
            value = (0, lib_1.clean)(value, false).replace(/\n*$/, '');
        }
        else {
            value = (0, lib_1.clean)(value);
        }
        const text = '|' + (unnamed ? '' : name + '=') + value.replace(/^\|/, '');
        const uftext = '|' + (unnamed ? '' : ufname + '=') + ufvalue.replace(/^\|/, '');
        const arg = { name, value, text, ufname, ufvalue, uftext, unnamed };
        __classPrivateFieldGet(this, _Template_instances, "m", _Template_registerArg).call(this, arg, logOverride);
    });
}, _Template_registerArg = function _Template_registerArg(arg, logOverride) {
    // Name if unnamed
    if (arg.unnamed) {
        for (let i = 1; i < Infinity; i++) {
            if (!this.keys.includes(i.toString())) {
                arg.name = i.toString();
                break;
            }
        }
    }
    // Check duplicates
    const hier = __classPrivateFieldGet(this, _Template_instances, "m", _Template_getHier).call(this, arg.name);
    let oldArg;
    if (hier !== null) {
        const foundArg = this.args[hier.index];
        if (hier.priority === 1 && arg.value || // There's an argument of a lower priority and this argument has a non-empty value
            hier.priority === -1 && !foundArg.value || // There's an argument of a higher priority and that argument's value is empty
            hier.priority === 0 && arg.value // This argument is a duplicate and has a non-empty value
        ) {
            if (logOverride) {
                this.overriddenArgs.push(foundArg); // Leave a log of the argument to be overidden
            }
            // Delete the formerly-registered argument and proceed to registering this argument
            this.keys.splice(hier.index, 1);
            this.args.splice(hier.index, 1);
        }
        else {
            // The current argument is to be overridden by a formerly-registered argument
            if (logOverride) {
                this.overriddenArgs.push(arg); // Leave a log of this argument
            }
            return; // Don't register this argument
        }
    }
    else if ((oldArg = this.getArg(arg.name))) {
        if (logOverride) {
            this.overriddenArgs.push(oldArg);
        }
        this.deleteArg(arg.name);
    }
    // Register the new argument
    this.keys.push(arg.name);
    this.args.push(arg);
}, _Template_getHier = function _Template_getHier(name) {
    let ret = null;
    if (!__classPrivateFieldGet(this, _Template_hierarchy, "f").length || !this.keys.length) {
        return ret;
    }
    __classPrivateFieldGet(this, _Template_hierarchy, "f").some((arr) => {
        // Does this hierarchy array contain the designated argument name?
        const prIdx = arr.indexOf(name);
        if (prIdx === -1)
            return false;
        // Does the Template already have an argument of the designated name or its alias?
        const prIdx2 = arr.findIndex((key) => this.keys.includes(key));
        const keyIdx = this.keys.findIndex((key) => arr.includes(key));
        if (prIdx2 === -1 || keyIdx === -1)
            return false;
        // The argument of either the designated name or its alias is to be overridden
        ret = {
            index: keyIdx,
            priority: prIdx2 > prIdx ? -1 : prIdx2 < prIdx ? 1 : 0
        };
        return true;
    });
    return ret;
};