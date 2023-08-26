"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Template_instances, _a, _Template_createTagRegex, _Template_registerArgFragment, _Template_newFromParsed, _Template_registerArgs;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
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
                console.log(`Unparsable parameter: ${para}`);
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
            excludeTags: [],
            recursive: true
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
                    if (!cfg.namePredicate || cfg.namePredicate(name)) {
                        const fullname = args[0] ? args[0].text : '';
                        const t = __classPrivateFieldGet(Template, _a, "m", _Template_newFromParsed).call(Template, name, fullname, args.slice(1));
                        if (!cfg.templatePredicate || cfg.templatePredicate(t)) {
                            ret.push(t);
                        }
                    }
                    if (cfg.recursive) {
                        const inner = wikitext.slice(startIdx + 2, i);
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
     * @param fullname Full string that should fit into the first slot of the template (`{{fullname}}`), **excluding**
     * double braces. May contain whitespace characters (`{{ fullname }}`) and/or expressions that are not part of the
     * template name (`{{ <!--name-->fullname }}`, `{{ {{{|safesubst:}}}fullname }}`, `{{ fullname \n}}`).
     * @throws When `fullname` does not contain `name` as a substring.
     */
    constructor(name, fullname) {
        _Template_instances.add(this);
        this.name = name;
        this.fullName = fullname || name;
        this.args = new Map();
        this.overriddenArgs = [];
        if (!this.fullName.includes(this.name)) {
            throw new Error(`fullname ("${this.fullName}") does not contain name ("${this.name}") as a substring.`);
        }
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
        const tmpl = Template.parseWikitext('{{' + argText + '}}', { recursive: false });
        for (const [key, obj] of tmpl[0].args.entries()) {
            if (this.args.has(key)) {
                this.overriddenArgs.push(Object.assign({}, this.args.get(key)));
            }
            this.args.set(key, obj);
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
     * Get a copy of the template argument object.
     */
    getArgs() {
        return Object.fromEntries(this.args);
    }
    /**
     * Get an argument value as an object, from an argument name.
     * @param name Argument name.
     * @param aliases An array of the argument name's aliases. Should not contain `name`.
     * @returns `null` if no argument is found with the specified name.
     */
    getArg(name) {
        if (typeof name === 'string') {
            name = new RegExp('^' + (0, lib_1.escapeRegExp)(name) + '$');
        }
        for (const k of this.args.keys()) {
            if (name.test(k) && this.args.has(k)) {
                return this.args.get(k);
            }
        }
        return null;
    }
    /**
     * Delete template arguments.
     * @param names
     * @returns Result of deletion, keyed by passed names and valued by booleans.
     */
    deleteArgs(names) {
        return names.reduce((acc, name) => {
            acc[name] = this.args.delete(name);
            return acc;
        }, Object.create(null));
    }
    /**
     * Delete a template argument.
     * @param name
     * @returns true if an element in the `args` existed and has been removed, or false if the element does not exist.
     */
    deleteArg(name) {
        return this.args.delete(name);
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
     * If you need the raw wikitext found by #parseWikitext, use `toString` or `render({nameprop: 'full', unformatted: true})`.
     *
     * @param options Optional object of rendering specifications
     */
    render(options) {
        options = options || {};
        let ret = '{{';
        // Render name
        let n;
        switch (options.nameprop) {
            case 'full':
                n = this.fullName;
                break;
            case 'clean':
                n = this.cleanName;
                break;
            case 'fullclean':
                n = this.fullCleanName;
                break;
            default:
                n = this.name;
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
        const [...args] = this.args.values();
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
            args: Object.fromEntries(this.args),
            overriddenArgs: this.overriddenArgs.slice()
        };
    }
}
exports.Template = Template;
_a = Template, _Template_instances = new WeakSet(), _Template_createTagRegex = function _Template_createTagRegex(config) {
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
}, _Template_newFromParsed = function _Template_newFromParsed(name, fullname, args) {
    const t = new Template(name, fullname);
    t.addArgs(args.map((obj) => ({ 'name': obj.name.replace(/^\|/, ''), value: obj.value })));
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
        if (unnamed) {
            for (let i = 1; i < Infinity; i++) {
                if (!this.args.has(i.toString())) {
                    name = i.toString();
                    break;
                }
            }
        }
        else if (logOverride && this.args.has(name)) {
            this.overriddenArgs.push(Object.assign({}, this.args.get(name)));
        }
        this.args.set(name, { name, value, text, ufname, ufvalue, uftext, unnamed });
    });
};
