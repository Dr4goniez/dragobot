import { clean, escapeRegExp } from './lib';
import { Title } from './title';
import { ucFirst } from './string';

/** The object that stores the properties of a template argument, used in {@link Template.args}. */
interface TemplateArgument {
	/**
	 * The argument name, from which unicode bidirectional characters and leading/trailing spaces are removed.
	 *
	 * Note that this property is never an empty string even for unnamed arguments.
	 */
	name: string;
	/**
	 * The argument value, from which unicode bidirectional characters are removed. As for leading/trailing spaces,
	 * whether they are removed depends on whether the argument is named: Unnamed arguments ignore them, while named
	 * ones don't. Note, however, that trailing linebreak characters are always removed.
	 */
	value: string;
	/**
	 * The argument's text created out of {@link TemplateArgument.name |name} and {@link value}, starting with a pipe character.
	 *
	 * Note that the name is not rendered for unnamed arguments.
	 */
	text: string;
	/**
	 * The unformatted argument name.
	 */
	ufname: string;
	/**
	 * The unformatted argument value.
	 */
	ufvalue: string;
	/**
	 * The argument's text created out of {@link ufname} and {@link ufvalue}, starting with a pipe character.
	 *
	 * Note that the name is not rendered for unnamed arguments.
	 */
	uftext: string;
	/**
	 * Whether the argument is named.
	 */
	unnamed: boolean;
}

export interface ArgumentHierarchy {
	/**
	 * Argument hierarchies.
	 *
	 * Module-invoking templates may have nested parameters; for example, `{{#invoke:module|user={{{1|{{{user|}}}}}}}}`
	 * can be transcluded as `{{template|user=value|1=value}}`. In this case, `|1=` and `|user=` should be regarded as
	 * instantiating the same template argument, and any non-empty `|user=` argument should override the `|1=` argument
	 * if any. To specify this type of argument hierarchies, pass `[['1', 'user'], [...]]`. Then, `|1=` will be
	 * overridden by `|user=` any time when an argument registration takes place and the operation detects the presence
	 * of a lower-hierarchy argument in the {@link Template} instance.
	 */
	hierarchy?: string[][];
}
/** The config object to be passed to {@link Template.constructor}. */
interface TemplateConfig extends ArgumentHierarchy {
	/**
	 * Full string that should fit into the first slot of the template (`{{fullName}}`), **excluding** double braces.
	 * May contain whitespace characters (`{{ fullName }}`) and/or expressions that are not part of the template name
	 * (`{{ <!--name-->fullName }}`, `{{ {{{|safesubst:}}}fullName }}`, `{{ fullName \n}}`).
	 */
	fullName?: string;
}

/**
 * The object that specifies what kind of a template argument should be added to {@link Template.args}.
 *
 * Used in {@link Template.addArgs} and {@link Template.setArgs}.
 */
interface NewArg {
	/**
	 * The name of the new argument. This can be an empty string if the class should automatically assign an integer name
	 * in accordance with the arguments that have already been registered.
	 *
	 * This property accepts leading/trailing spaces, for an output of e.g. `| 1 = value ` instead of `|1=value` (a config
	 * object must be passed to {@link Template.render} for this output).
	 */
	name: string;
	/**
	 * The value of the new argument.
	 *
	 * This property accepts leading/trailing spaces, for an output of e.g. `| 1 = value ` instead of `|1=value` (a config
	 * object must be passed to {@link Template.render} for this output). It can also end with `\n` when the argument should
	 * have a linebreak before the next argument or `}}` (although whether to add a new line should instead be specified by
	 * passing {@link RenderOptions.linebreak} or {@link RenderOptions.linebreakPredicate} to {@link Template.render}).
	 */
	value: string;
	/**
	 * Forcibly register this (integer-named) argument as unnamed. Ignored if {@link NewArg.name|name} (after being formatted)
	 * is not of an integer.
	 */
	forceUnnamed?: boolean;
}

/**
 * Object used to process the argument hierarchies of a template.
 */
interface TemplateArgumentHierarchy {
	/** The index number of `name` or its alias in {@link Template.keys}. */
	index: number;
	/** `1` if `name` is on a higher position than `key` is in the hierarchy, `-1` if lower, `0` if the same. */
	priority: number;
}

/** The option object passed to {@link Template.getArg} and {@link Template.hasArg}. */
interface GetArgOptions {
	/**
	 * Check whether the argument with the matched name meets this condition predicate.
	 * @param arg
	 */
	conditionPredicate?: (arg: TemplateArgument) => boolean;
}
/** The option object uniquely passed to {@link Template.getArg} (and not to {@link Template.hasArg}). */
interface GetArgUniqueOptions {
	/**
	 * If `true`, look for the first match, instead of the last.
	 */
	findFirst?: boolean;
}

/** The option object passed to {@link Template.render}. */
export interface RenderOptions {
	/**
	 * Use the template name of this format. See {@link Template.getName} for details.
	 */
	nameprop?: 'full'|'clean'|'fullclean';
	/**
	 * Whether to add `subst:` before the template name.
	 */
	subst?: boolean;
	/**
	 * For template arguments, use the unformatted counterpart(s) of {@link TemplateArgument.name |name} (i.e. 
	 * {@link TemplateArgument.ufname |ufname}), {@link TemplateArgument.value |value} (i.e. {@link TemplateArgument.ufvalue |ufvalue}),
	 * or both, instead of the formatted ones. Note that specifying this option disables the auto-rendering of
	 * the name of an unnamed argument whose value contains a `=`.
	 */
	unformatted?: 'name'|'value'|'both';
	/**
	 * Callback function to {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort |Array.prototype.sort},
	 * called on the {@link Template.args} array before stringifying the template arguments.
	 * @param obj1
	 * @param obj2
	 */
	sortPredicate?: (obj1: TemplateArgument, obj2: TemplateArgument) => number;
	/**
	 * Whether to break lines for each template slot. Overridden by {@link linebreakPredicate}.
	 * 
	 * Note that if this option is specified, all trailing `\n`s are first removed, and it is then evaluated whether to
	 * add an `\n` at the end of the slot.
	 */
	linebreak?: boolean;
	/**
	 * Put a new line in accordance with this predicate. Prioritized than {@link linebreak}.
	 * 
	 * Note that if this option is specified, all trailing `\n`s are first removed, and it is then evaluated whether to
	 * add an `\n` at the end of the slot.
	 */
	linebreakPredicate?: {
		/**
		 * Whether to put a new line after the first template slot for the name. `\n` is added if the callback is true.
		 * @param name The template's name in accordance with {@link RenderOptions.nameprop}.
		 */
		name: (name: string) => boolean;
		/**
		 * Whether to put a new line after each template argument. `\n` is added if the callback is true.
		 * @param obj
		 */
		args: (obj: TemplateArgument) => boolean;
	};
}

/** The object returned by {@link Template.toJSON}. */
export interface TemplateJSON {
	name: string;
	fullName: string;
	cleanName: string;
	fullCleanName: string;
	args: TemplateArgument[];
	keys: string[];
	overriddenArgs: TemplateArgument[];
	hierarchy: string[][];
}

/**
 * The `Template` class. Creates a new {{template}}.
 */
export class Template {

	/**
	 * The trimmed `name` passed to the {@link Template.constructor |constructor}.
	 * @readonly
	 */
	readonly name: string;
	/**
	 * Full string that fits into the first slot of the template (i.e. `{{fullName}}`). May be accompanied by additional
	 * characters that are not relevant to the title of the page to be transcluded.
	 * @readonly
	 */
	readonly fullName: string;
	/**
	 * {@link Template.name |name} formatted by `Title.newFromText`.
	 * @readonly
	 */
	readonly cleanName: string;
	/**
	 * {@link cleanName} with redundancies as in {@link fullName}.
	 * @readonly
	 */
	readonly fullCleanName: string;
	/**
	 * The arguments of the template parsed as an array of objects.
	 * @readonly
	 */
	readonly args: TemplateArgument[];
	/**
	 * An array of the names of the template arguments.
	 * @readonly
	 */
	readonly keys: string[];
	/**
	 * The overridden arguments of the template stored as an array of objects.
	 * @readonly
	 */
	readonly overriddenArgs: TemplateArgument[];
	/**
	 * Argument hierarchies.
	 * @protected
	 */
	protected readonly hierarchy: string[][];

	/**
	 * Initialize a new {@link Template} instance.
	 *
	 * @param name Name of the page that is to be transcluded. Should not contain anything but a page title.
	 * @param config Optional initializer object.
	 * @throws {Error} When `name` has inline `\n` characters or when {@link TemplateConfig.fullName |fullName}
	 * does not contain `name` as a substring.
	 */
	constructor(name: string, config?: TemplateConfig) {

		const cfg = config || {};
		this.name = clean(name);
		if (this.name.includes('\n')) {
			throw new Error(`name ("${name}") is not allowed to contain inline "\\n" characters.`);
		}
		this.fullName = clean(cfg.fullName || name, false);
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
		name = clean(name);

		// Set cleanName
		const title = Title.newFromText(name); // The passed "name" is trimmed and without a leading colon
		if (!title) {
			this.cleanName = colon + ucFirst(name);
		} else if (title.getNamespaceId() === 10) { // Template:XXX
			this.cleanName = title.getMain(true); // Get XXX
		} else if (title.getNamespaceId() === 0) {
			this.cleanName = colon + title.getMain(true);
		} else {
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
	getName(prop?: 'full'|'clean'|'fullclean'): string {
		if (!prop) {
			return this.name;
		} else if (prop === 'fullclean') {
			return this.fullCleanName;
		} else if (prop === 'full') {
			return this.fullName;
		} else {
			return this.cleanName;
		}
	}

	/**
	 * Register template arguments into {@link args}.
	 *
	 * @param newArgs An array of `{name: string; value: string;}` objects.
	 * @param logOverride Whether to leave a log when overriding argument values.
	 */
	private registerArgs(newArgs: NewArg[], logOverride: boolean) {
		newArgs.forEach(({name, value, forceUnnamed}) => {

			const ufname = name;
			const ufvalue = value;
			name = clean(name);
			const unnamed = /^\d+$/.test(name) && forceUnnamed || !name;
			if (unnamed) {
				value = clean(value, false).replace(/\n*$/, '');
			} else {
				value = clean(value);
			}
			const text = '|' + (unnamed ? '' : name + '=') + value.replace(/^\|/, '');
			const uftext = '|' + (unnamed ? '' : ufname + '=') + ufvalue.replace(/^\|/, '');

			this.registerArg(
				{name, value, text, ufname, ufvalue, uftext, unnamed},
				logOverride
			);

		});
	}

	/**
	 * @param arg New argument object to register.
	 * @param logOverride Whether to leave a log when overriding argument values.
	 */
	private registerArg(arg: TemplateArgument, logOverride: boolean) {

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
		let oldArg: TemplateArgument|null;
		if (hier !== null) {
			const foundArg = this.args[hier.index];
			if (hier.priority === 1 && arg.value || // There's an argument of a lower priority and this argument has a non-empty value
				hier.priority === -1 && !foundArg.value || // There's an argument of a higher priority and that argument's value is empty
				hier.priority === 0 && arg.value // This argument is a duplicate and has a non-empty value
			) {
				if (logOverride) {
					this.overriddenArgs.push({...foundArg}); // Leave a log of the argument to be overidden
				}
				// Delete the formerly-registered argument and proceed to registering this argument
				this.keys.splice(hier.index, 1);
				this.args.splice(hier.index, 1);
			} else {
				// The current argument is to be overridden by a formerly-registered argument
				if (logOverride) {
					this.overriddenArgs.push({...arg}); // Leave a log of this argument
				}
				return; // Don't register this argument
			}
		} else if ((oldArg = this.getArg(arg.name))){
			if (logOverride) {
				this.overriddenArgs.push({...oldArg});
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
	private getHier(name: string): TemplateArgumentHierarchy|null {
		let ret = null;
		if (!this.hierarchy.length || !this.keys.length) {
			return ret;
		}
		this.hierarchy.some((arr) => {

			// Does this hierarchy array contain the designated argument name?
			const prIdx = arr.indexOf(name);
			if (prIdx === -1) return false;

			// Does the Template already have an argument of the designated name or its alias?
			const prIdx2 = arr.findIndex((key) => this.keys.includes(key));
			const keyIdx = this.keys.findIndex((key) => arr.includes(key));
			if (prIdx2 === -1 || keyIdx === -1) return false;

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
	addArgs(newArgs: NewArg[]): Template {
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
	setArgs(newArgs: NewArg[]): Template {
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
	getArgs(deepCopy = true): TemplateArgument[] {
		if (deepCopy) {
			return this.args.map(obj => ({...obj}));
		} else {
			return this.args;
		}
	}

	/**
	 * Get (a deep copy of) a template argument by an argument name.
	 * @param name Argument name.
	 * @param options Optional search options.
	 * @returns `null` if no argument is found with the specified name.
	 */
	getArg(name: string|RegExp, options?: GetArgOptions & GetArgUniqueOptions): TemplateArgument|null {

		options = options || {};

		const nameRegex = typeof name === 'string' ? new RegExp(`^${escapeRegExp(name)}$`) : name;
		let firstMatch: TemplateArgument|null = null;
		let lastMatch: TemplateArgument|null = null;
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
		if (ret) ret = Object.assign({}, ret);
		return ret;

	}

	/**
	 * Check whether the {@link Template} instance has an argument with a certain name.
	 * @param name Name of the argument to search for.
	 * @param options Optional search options.
	 * @returns A boolean value in accordance with whether there is a match.
	 */
	hasArg(name: string|RegExp, options?: GetArgOptions): boolean {
		options = options || {};
		const nameRegex = typeof name === 'string' ? new RegExp(`^${escapeRegExp(name)}$`) : name;
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
	deleteArgs(names: string[]): TemplateArgument[] {
		return names.reduce((acc: TemplateArgument[], name) => {
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
	deleteArg(name: string): boolean {
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
	getOverriddenArgs(): TemplateArgument[] {
		return this.overriddenArgs.map(obj => ({...obj}));
	}

	/**
	 * Get the argument hierarchies.
	 * @returns
	 */
	getHierarchy(): string[][] {
		return this.hierarchy.map(arr => [...arr]);
	}

	/**
	 * Render the {@link Template} instance as wikitext.
	 *
	 * Use `render({nameprop: 'full', unformatted: 'both'})` for an output that is closest to the original configurations.
	 *
	 * @param options Optional object of rendering specifications
	 */
	render(options?: RenderOptions): string {

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
		} else if (options.linebreak) {
			ret += n.replace(/\n+$/, '') + '\n';
		} else {
			ret += n;
		}

		// Render args
		const args = this.args.map(obj => ({...obj}));
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
			} else if (options.linebreak) {
				ret += text.replace(/\n+$/, '') + '\n';
			} else {
				ret += text;
			}
		}
		ret += '}}';

		return ret;

	}

	/**
	 * Stringify the {@link Template} instance. Same as `render({nameprop: 'full', unformatted: 'both'})`.
	 */
	toString(): string {
		return this.render({nameprop: 'full', unformatted: 'both'});
	}

	/**
	 * Get class properties in a JSON format.
	 */
	toJSON(): TemplateJSON {
		return {
			name: this.name,
			fullName: this.fullName,
			cleanName: this.cleanName,
			fullCleanName: this.fullCleanName,
			args: this.args.map(obj => ({...obj})),
			keys: this.keys.slice(),
			overriddenArgs: this.overriddenArgs.map(obj => ({...obj})),
			hierarchy: this.hierarchy.map(arr => [...arr])
		};
	}

}