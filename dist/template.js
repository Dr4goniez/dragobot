"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
const lib_1 = require("./lib");
const title_1 = require("./title");
const string_1 = require("./string");
/**
 * The `Template` class. Creates a new {{template}}.
 */
class Template {
    /**
     * Initialize a new {@link Template} instance.
     *
     * @param name Name of the page that is to be transcluded. Should not contain anything but a page title.
     * @param config Optional initializer object.
     * @throws {Error} When `name` has inline `\n` characters or when {@link TemplateConfig.fullName |fullName}
     * does not contain `name` as a substring.
     */
    constructor(name, config) {
        const cfg = config || {};
        this.name = (0, lib_1.clean)(name);
        if (this.name.includes('\n')) {
            throw new Error(`name ("${name}") is not allowed to contain inline "\\n" characters.`);
        }
        this.fullName = (0, lib_1.clean)(cfg.fullName || name, false);
        this.args = [];
        this.keys = [];
        this.overriddenArgs = [];
        if (!this.fullName.includes(this.name)) {
            throw new Error(`fullName ("${this.fullName}") does not contain name ("${this.name}") as a substring.`);
        }
        this.hierarchy = cfg.hierarchy || [];
        // Truncate the leading colon, if any
        let colon = '';
        name = name.replace(/^[^\S\r\n]*(:?)[^\S\r\n]*/, (_, $1) => {
            colon = $1;
            return '';
        });
        name = (0, lib_1.clean)(name);
        // Set cleanName
        const title = title_1.Title.newFromText(name); // The passed "name" is trimmed and without a leading colon
        if (!title) {
            this.cleanName = colon + (0, string_1.ucFirst)(name);
        }
        else if (title.getNamespaceId() === 10) { // Template:XXX
            this.cleanName = title.getMain(true); // Get XXX
        }
        else if (title.getNamespaceId() === 0) {
            this.cleanName = colon + title.getMain(true);
        }
        else {
            this.cleanName = title.getPrefixedDb(true);
        }
        this.fullCleanName = this.fullName.replace(this.name, this.cleanName);
    }
    /**
     * Get the name of the template.
     *
     * @param prop By default, returns the original, unformatted `name` passed to {@link Template.constructor}.
     * - If `full` is passed, returns {@link TemplateConfig.fullName |fullName} passed to {@link Template.constructor}
     * (same as `name` if none was passed).
     * - If `clean` is passed, returns {@link Template.name |name} that is formatted.
     * - If `fullclean` is passed, returns {@link Template.name |name} that is formatted and accompanied by redundancies
     * as in {@link TemplateConfig.fullName |fullName}.
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
     * // name: project:test', fullName: '<!--change?-->project:test
     * const template = new Template('project:test', {fullName: '<!--change?-->project:test'});
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
     * Register template arguments into {@link args}.
     *
     * @param newArgs An array of `{name: string; value: string;}` objects.
     * @param logOverride Whether to leave a log when overriding argument values.
     */
    registerArgs(newArgs, logOverride) {
        newArgs.forEach(({ name, value, forceUnnamed }) => {
            const ufname = name;
            const ufvalue = value;
            name = (0, lib_1.clean)(name);
            const unnamed = /^\d+$/.test(name) && forceUnnamed || !name;
            if (unnamed) {
                value = (0, lib_1.clean)(value, false).replace(/\n*$/, '');
            }
            else {
                value = (0, lib_1.clean)(value);
            }
            const text = '|' + (unnamed ? '' : name + '=') + value.replace(/^\|/, '');
            const uftext = '|' + (unnamed ? '' : ufname + '=') + ufvalue.replace(/^\|/, '');
            this.registerArg({ name, value, text, ufname, ufvalue, uftext, unnamed }, logOverride);
        });
    }
    /**
     * @param arg New argument object to register.
     * @param logOverride Whether to leave a log when overriding argument values.
     */
    registerArg(arg, logOverride) {
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
        const hier = this.getHier(arg.name);
        let oldArg;
        if (hier !== null) {
            const foundArg = this.args[hier.index];
            if (hier.priority === 1 && arg.value || // There's an argument of a lower priority and this argument has a non-empty value
                hier.priority === -1 && !foundArg.value || // There's an argument of a higher priority and that argument's value is empty
                hier.priority === 0 && arg.value // This argument is a duplicate and has a non-empty value
            ) {
                if (logOverride) {
                    this.overriddenArgs.push({ ...foundArg }); // Leave a log of the argument to be overidden
                }
                // Delete the formerly-registered argument and proceed to registering this argument
                this.keys.splice(hier.index, 1);
                this.args.splice(hier.index, 1);
            }
            else {
                // The current argument is to be overridden by a formerly-registered argument
                if (logOverride) {
                    this.overriddenArgs.push({ ...arg }); // Leave a log of this argument
                }
                return; // Don't register this argument
            }
        }
        else if ((oldArg = this.getArg(arg.name))) {
            if (logOverride) {
                this.overriddenArgs.push({ ...oldArg });
            }
            this.deleteArg(arg.name);
        }
        // Register the new argument
        this.keys.push(arg.name);
        this.args.push(arg);
    }
    /**
     * Check whether a given argument is to be hierarchically overridden.
     * @param name
     */
    getHier(name) {
        let ret = null;
        if (!this.hierarchy.length || !this.keys.length) {
            return ret;
        }
        this.hierarchy.some((arr) => {
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
    }
    /**
     * Add new arguments to the {@link Template} instance. This method leaves a log when argument override takes place,
     * which can be viewed by {@link getOverriddenArgs}.
     *
     * @param newArgs An array of `{name: string; value: string;}` objects.
     */
    addArgs(newArgs) {
        this.registerArgs(newArgs, true);
        return this;
    }
    /**
     * Set (or update) arguments in(to) the {@link Template} instance. This method does not leave a log when argument override takes place.
     *
     * Note: New arguments are simply newly added, just as when {@link addArgs} is used.
     *
     * @param newArgs An array of `{name: string; value: string;}` objects.
     */
    setArgs(newArgs) {
        this.registerArgs(newArgs, false);
        return this;
    }
    /**
     * Get the arguments of the template as an array of objects.
     *
     * @param deepCopy Whether to return a deep copy, defaulted to `true`. Otherwise, {@link args} is passed by reference
     * (not recommended).
     * @returns
     */
    getArgs(deepCopy = true) {
        if (deepCopy) {
            return this.args.map(obj => ({ ...obj }));
        }
        else {
            return this.args;
        }
    }
    /**
     * Get (a deep copy of) a template argument by an argument name.
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
     * Check whether the {@link Template} instance has an argument with a certain name.
     * @param name Name of the argument to search for.
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
     * @returns `true` if the instance has an argument with the specified name and if the argument is successfully removed,
     * `false` otherwise.
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
        return this.overriddenArgs.map(obj => ({ ...obj }));
    }
    /**
     * Get the argument hierarchies.
     * @returns
     */
    getHierarchy() {
        return this.hierarchy.map(arr => [...arr]);
    }
    /**
     * Render the {@link Template} instance as wikitext.
     *
     * Use `render({nameprop: 'full', unformatted: 'both'})` for an output that is closest to the original configurations.
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
            ret += n.replace(/\n+$/, '') + (options.linebreakPredicate.name(n) ? '\n' : '');
        }
        else if (options.linebreak) {
            ret += n.replace(/\n+$/, '') + '\n';
        }
        else {
            ret += n;
        }
        // Render args
        const args = this.args.map(obj => ({ ...obj }));
        if (options.sortPredicate) {
            args.sort(options.sortPredicate);
        }
        for (const obj of args) {
            let text = '|';
            const name = options.unformatted === 'name' || options.unformatted === 'both' ? obj.ufname : obj.name;
            const value = options.unformatted === 'value' || options.unformatted === 'both' ? obj.ufvalue : obj.value;
            if (!obj.unnamed || !options.unformatted && value.includes('=')) {
                text += name + '=';
            }
            text += value;
            if (options.linebreakPredicate) {
                ret += text.replace(/\n+$/, '') + (options.linebreakPredicate.args(obj) ? '\n' : '');
            }
            else if (options.linebreak) {
                ret += text.replace(/\n+$/, '') + '\n';
            }
            else {
                ret += text;
            }
        }
        ret += '}}';
        return ret;
    }
    /**
     * Stringify the {@link Template} instance. Same as `render({nameprop: 'full', unformatted: 'both'})`.
     */
    toString() {
        return this.render({ nameprop: 'full', unformatted: 'both' });
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
            args: this.args.map(obj => ({ ...obj })),
            keys: this.keys.slice(),
            overriddenArgs: this.overriddenArgs.map(obj => ({ ...obj })),
            hierarchy: this.hierarchy.map(arr => [...arr])
        };
    }
}
exports.Template = Template;
