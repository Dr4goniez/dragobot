import { clean, escapeRegExp } from './lib';
import { Title } from './title';
import { ucFirst } from './string';

/** The object that stores the properties of a template argument, used in `Template.args`. */
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
	 * The argument's text created out of `name` and `value`, starting with a pipe character.
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
	 * The argument's text created out of `ufname` and `ufvalue`, starting with a pipe character.
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
	 * When the template has `|user={{{1|{{{user|}}}}}}` for instance, the value of `{{{1}}}` should be overridden by
	 * `{{{user}}}`. In this case, pass `[['1', 'user'], [...]]`.
	 */
	hierarchy?: string[][];
}
/** The config object of the `Template` constructor. */
interface ConstructorConfig extends ArgumentHierarchy {
	/**
	 * Full string that should fit into the first slot of the template (`{{fullName}}`), **excluding** double braces.
	 * May contain whitespace characters (`{{ fullName }}`) and/or expressions that are not part of the template name
	 * (`{{ <!--name-->fullName }}`, `{{ {{{|safesubst:}}}fullName }}`, `{{ fullName \n}}`).
	 */
	fullName?: string;
}

/**
 * The object that is an element of the array to specify what template arguments to add/update.
 *
 * Used in `Template.addArgs` and `Template.setArgs`.
 */
interface NewArg {
	/**
	 * The name of the new argument. This can be an empty string if the class should automatically assign an interger name
	 * in accordance with the arguments that have already been registered.
	 *
	 * This property accepts leading/trailing spaces, for an output wikitext of e.g. `| 1 = value ` instead of `|1=value`.
	 */
	name: string;
	/**
	 * The value of the new argument.
	 *
	 * This property accepts leading/trailing spaces, for an output wikitext of e.g. `| 1 = value ` instead of `|1=value`.
	 * It can also end with `\n` when the argument should have a linebreak before the next argument or `}}`.
	 */
	value: string;
}

/** The option object passed to `Template.getArg` and `Template.hasArg`. */
interface GetArgOptions {
	/**
	 * If provided, also check whether the argument with the matched name meets this condition predicate.
	 * @param arg
	 */
	conditionPredicate?: (arg: TemplateArgument) => boolean;
}

/** The option object passed to `Template.render`. */
export interface RenderOptions {
	/**
	 * Use the template name of this format. See #Template.getName for details.
	 */
	nameprop?: 'full'|'clean'|'fullclean';
	/**
	 * Whether to add `subst:` before the template name.
	 */
	subst?: boolean;
	/**
	 * Use `uftext` instead of `text` for `args`.
	 */
	unformatted?: boolean;
	/**
	 * Callback function to `Array.prototype.sort`, called on the `args` array before stringifying the template arguments.
	 * @param obj1
	 * @param obj2
	 */
	sortPredicate?: (obj1: TemplateArgument, obj2: TemplateArgument) => number;
	/**
	 * Whether to break lines for each template slot.
	 */
	linebreak?: boolean;
	/**
	 * Put a new line in accordance with this predicate. Prioritized than `linebreak`.
	 */
	linebreakPredicate?: {
		/**
		 * Whether to put a new line after the first "name" template slot. `\n` is added if the callback is true.
		 * @param name The template's name in accordance with `nameprop`.
		 */
		name: (name: string) => boolean;
		/**
		 * Whether to put a new line after each template argument. `\n` is added if the callback is true, to either
		 * `uftext` (when `{unformatted: true}`) or `text` (when `{unformatted: false}`).
		 * @param obj
		 */
		args: (obj: TemplateArgument) => boolean;
	};
}

/** The object returned by `Template.toJSON`. */
export interface TemplateJSON {
	name: string;
	fullName: string;
	cleanName: string;
	fullCleanName: string;
	args: TemplateArgument[];
	overriddenArgs: TemplateArgument[];
}

export class Template {

	/**
	 * Name of the page that is to be transcluded. Should not contain anything but a page title.
	 * @readonly
	 */
	readonly name: string;
	/**
	 * Full string that fits into the first slot of the template (`{{fullName}}`). May be accompanied by additional
	 * characters that are not relevant to the title of the page to be transcluded.
	 * @readonly
	 */
	readonly fullName: string;
	/**
	 * `name` formatted by `Title.newFromText`.
	 * @readonly
	 */
	readonly cleanName: string;
	/**
	 * `cleanName` replacing `name` in `fullName`;
	 * @readonly
	 */
	readonly fullCleanName: string;
	/**
	 * Stores template arguments.
	 * @readonly
	 */
	readonly args: TemplateArgument[];
	/**
	 * Stores template argument keys.
	 * @readonly
	 */
	readonly keys: string[];
	/**
	 * Stores overridden template arguments.
	 * @readonly
	 */
	readonly overriddenArgs: TemplateArgument[];
	/**
	 * Argument hierarchies.
	 * @private
	 */
	#hierarchy: string[][];

	/**
	 * Initialize a new `Template` instance.
	 *
	 * @param name Name of the page that is to be transcluded. Should not contain anything but a page title.
	 * @param config Optional initializer object.
	 * @throws {Error} When `config.fullName` does not contain `name` as a substring.
	 */
	constructor(name: string, config?: ConstructorConfig) {

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
		this.#hierarchy = cfg.hierarchy || [];

		// Truncate the leading colon, if any
		let colon = '';
		name = name.replace(/^[^\S\r\n]*:[^\S\r\n]*/, (m) => {
			colon = m;
			return '';
		});

		// Set cleanName
		const title = Title.newFromText(name);
		if (!title) {
			this.cleanName = colon + ucFirst(name);
		} else if (title.getNamespaceId() === 10) {
			this.cleanName = title.getMain(true);
		} else if (title.getNamespaceId() === 0) {
			this.cleanName = colon.trim() + title.getMain(true);
		} else {
			this.cleanName = title.getPrefixedDb(true);
		}
		this.fullCleanName = this.fullName.replace(this.name, this.cleanName);

	}

	/**
	 * Get the name of the template.
	 *
	 * @param prop By default, returns `name` passed to #constructor.
	 * - If `full` is passed, returns `fullName` passed to #constructor (same as `name` if none was passed).
	 * - If `clean` is passed, returns the formatted name.
	 * - If `fullclean` is passed, returns the formatted name pushed into `fullName`.
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
	 * const template = new Template('project:test', '<!--change?-->project:test');
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
	 * Register template arguments into `Template.args`.
	 *
	 * @param newArgs An array of `{name: string; value: string;}` objects.
	 * @param logOverride Whether to leave a log when overriding argument values.
	 */
	#registerArgs(newArgs: NewArg[], logOverride: boolean) {
		newArgs.forEach(({name, value}) => {

			const ufname = name;
			const ufvalue = value;
			name = clean(name);
			const unnamed = !name;
			if (unnamed) {
				value = clean(value, false).replace(/\n*$/, '');
			} else {
				value = clean(value);
			}
			const text = '|' + (unnamed ? '' : name + '=') + value.replace(/^\|/, '');
			const uftext = '|' + (unnamed ? '' : ufname + '=') + ufvalue.replace(/^\|/, '');

			this.#registerArg(
				{name, value, text, ufname, ufvalue, uftext, unnamed},
				logOverride
			);

		});
	}

	/**
	 * @param arg New argument object to register.
	 * @param logOverride Whether to leave a log when overriding argument values.
	 */
	#registerArg(arg: TemplateArgument, logOverride: boolean) {

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
		const hier = this.#getHier(arg.name);
		let oldArg: TemplateArgument|null;
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
			} else {
				// The current argument is to be overridden by a formerly-registered argument
				if (logOverride) {
					this.overriddenArgs.push(arg); // Leave a log of this argument
				}
				return; // Don't register this argument
			}
		} else if ((oldArg = this.getArg(arg.name))){
			if (logOverride) {
				this.overriddenArgs.push(oldArg);
			}
			this.deleteArg(arg.name);
		}

		// Register the new argument
		this.keys.push(arg.name);
		this.args.push(arg);

	}

	/**
	 * Check whether a certain argument is to be overridden.
	 * @param name
	 */
	#getHier(name: string): {
		/** The index number of `name` or its alias in `this.keys`. */
		index: number;
		/** `1` if `name` is on a higher position than `key` is in the hierarchy, `-1` if lower, `0` if the same. */
		priority: number;
	}|null {
		let ret = null;
		if (!this.#hierarchy.length || !this.keys.length) {
			return ret;
		}
		this.#hierarchy.some((arr) => {

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
	 * Add new arguments to the `Template` instance. This method leaves a log when argument override takes place,
	 * which can be viewed by `getOverriddenArgs`.
	 *
	 * @param newArgs An array of `{name: string; value: string;}` objects.
	 */
	addArgs(newArgs: NewArg[]) {
		this.#registerArgs(newArgs, true);
	}

	/**
	 * Add template arguments from a raw text (e.g. `|1=v1|2=v2`).
	 *
	 * @param argText String starting with a pipe character ("|").
	 * @throws When `argText` does not start with a pipe character.
	 */
	// addArgsFromText(argText: string) {
	// 	if (argText[0] !== '|') {
	// 		throw new Error(`String passed to addArgsFromText must start with a pipe character (input: "${argText}")`);
	// 	}
	// 	const tmpl = Wikitext.parseTemplates('{{' + argText + '}}', {recursivePredicate: () => false})[0];
	// 	for (let i = 0; i < tmpl.overriddenArgs.length; i++) {
	// 		const oArg = tmpl.overriddenArgs[i];
	// 		this.overriddenArgs.push(oArg);
	// 	}
	// 	for (let i = 0; i < tmpl.args.length; i++) {
	// 		this.#registerArg(tmpl.args[i], true);
	// 	}
	// }

	/**
	 * Set (or update) arguments in(to) the `Template` instance. This method does not leave a log when argument override takes place.
	 *
	 * Note: New arguments are simply newly added, just as when `addArgs` is used.
	 *
	 * @param newArgs An array of `{name: string; value: string;}` objects.
	 */
	setArgs(newArgs: NewArg[]) {
		this.#registerArgs(newArgs, false);
	}

	/**
	 * Get template arguments as an array of objects.
	 *
	 * @param deepCopy Whether to return a deep copy, defaulted to `true`. Otherwise, `Template.args` is passed by reference.
	 * Note, however, that the latter option is not recommended because directly modifying the argument array can fatally complicate it.
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
	 * Get a deep copy of a template argument from an argument name.
	 * @param name Argument name.
	 * @param options Optional search options.
	 * @returns `null` if no argument is found with the specified name.
	 */
	getArg(name: string|RegExp, options?: GetArgOptions & {
		/**
		 * If true, look for the first match, instead of the last.
		 */
		findFirst?: boolean;
	}): TemplateArgument|null {

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
	 * Check whether the `Template` instance has an argument with a certain name.
	 * @param name Name of the argument to search.
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
	 * @returns true if an element in the `args` existed and has been removed, or false if the element does not exist.
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
		return this.overriddenArgs.slice();
	}

	/**
	 * Render the `Template` instance as wikitext.
	 *
	 * If you need the raw wikitext found by `Wikitext.parseTemplates`, use `renderOriginal`. Note that `toString` or
	 * `render({nameprop: 'full', unformatted: true})` returns a similar result, except that these two methods
	 * do not render duplicate arguments, unlike `renderOriginal`.
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
			ret += n + (options.linebreakPredicate.name(n) ? '\n' : '');
		} else if (options.linebreak) {
			ret += n.replace(/\n+$/, '') + '\n';
		} else {
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
			} else if (options.linebreak) {
				ret += el.replace(/\n+$/, '') + '\n';
			} else {
				ret += el;
			}
		}
		ret += '}}';

		return ret;

	}

	/**
	 * Stringify the `Template` instance. Same as `render({nameprop: 'full', unformatted: true})`.
	 */
	toString(): string {
		return this.render({nameprop: 'full', unformatted: true});
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
			overriddenArgs: this.overriddenArgs.map(obj => ({...obj}))
		};
	}

}