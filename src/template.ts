import { log } from './server';
import { clean, escapeRegExp } from './lib';
import { Title } from './title';
import { ucFirst } from './string';

interface TagRegex {
	/**
	 * A regex that matches (closed) tags that prevent transclusions. Tags to match are affected by `config.includeTags` and `config.excludeTags`.
	 * 
	 * Default: `/^(?:<(nowiki|pre|syntaxhighlight|source|math)[^>]*?(?:\/>|>[\s\S]*?<\/\1>)|<!--[\s\S]*?-->)/`
	 */
	closedTag: RegExp|null;
	/**
	 * A regex that matches (open) tags that prevent transclusions. Tags to match are affected by `config.includeTags` and `config.excludeTags`.
	 * 
	 * Default: `/^(?:<(nowiki|pre|syntaxhighlight|source|math)[^>]*?>|<!--)[\s\S]*$/`
	 */
	openTag: RegExp|null;
}
interface TagConfig {
	/**
	 * By default, brace-enclosed expressions aren't parsed if they are inside tags that prevent transclusions.
	 * Specify, with this parameter, tags inside which the expressions should nevertheless be parsed. Note, however, that
	 * specifying this config may lead to unexpected results.
	 * 
	 * Accepted values: `comment` (for `<!--`), `nowiki`, `pre`, `syntaxhighlight`, `source`, `math`
	 */
	includeTags?: string[];
	/**
	 * Additional tags inside which brace-enclosed expressions shouldn't be parsed.
	 */
	excludeTags?: string[];
	/** 
	 * Private parameter, a regex object already created by `createTagRegex`.
	 */
	_tagRegex?: TagRegex;
}

interface TemplateConfig extends TagConfig {
	/**
	 * Only parse templates whose names match this predicate.
	 * @param name The parsed name of the template. This is not formatted, and might have a lowercase first letter and/or
	 * a `Template:` namespace prefix.
	 */
	namePredicate?: (name: string) => boolean;
	/**
	 * Only parse templates whose `Template` instances match this predicate. Can be used together with `namePredicate`,
	 * although this predicate is evaluated after evaluating `namePredicate`.
	 * @param Template
	 */
	templatePredicate?: (Template: Template) => boolean;
	/** 
	 * Parse nested templates in accordance with this predicate.
	 * 
	 * Default: Always parse nested templates
	 */
	recursivePredicate?: (Template: Template) => boolean;
}

interface FragmentOptions {
	/** Whether the passed fragment can be part of the name of the template. */
	nonname?: boolean;
	/** Whether the passed fragment starts a new template argument. */
	new?: boolean;
}
interface ParsedArgument {
	/** 
	 * The whole text of the template argument (e.g. `|1=value`).
	 */
	text: string;
	/** 
	 * The name of the template argument, if any (e.g. `1`). If the argument isn't named, this property carries an empty string.
	 * This property carries a direct parsing result and is always prefixed by a pipe character for named arguments. 
	 */
	name: string;
	/** 
	 * The value of the template argument.
	 */
	value: string;
}

interface TemplateArgument {
	name: string;
	value: string;
	text: string;
	ufname: string;
	ufvalue: string;
	uftext: string;
	unnamed: boolean;
}
/**
 * An array of objects that specify what template arguments to add/update.
 * 
 * The `name` property can be an emptry string, in which case the class automatically assigns an interger name
 * in accordance with the arguments that have already been registered. Both the `name` and `value` properties can
 * have leading/trailing spaces, for an output wikitext of e.g. `| 1 = value ` instead of `|1=value`. The `value`
 * property can also end with `\n` when the argument should have a linebreak before the next argument or `}}`.
 */
type NewArgsArray = {
	name: string;
	value: string;
}[];

interface ArgumentSearchOptions {
	/**
	 * If provided, also check whether the argument with the matched name meets this condition predicate.
	 * @param arg 
	 */
	conditionPredicate?: (arg: TemplateArgument) => boolean;
}

interface TemplateRenderOptions {
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

export class Template {

	/** 
	 * Get regexes that match tags that prevent transclusions.
	 * 
	 * Default tags: `comment` (`<!--`), `nowiki`, `pre`, `syntaxhighlight`, `source`, `math`
	 * 
	 * @param config Optional tag specification object, referring to which the regex is created.
	 */
	static #createTagRegex(config?: TagConfig): TagRegex {

		const cfg: TagConfig = {
			includeTags: [],
			excludeTags: []
		};
		Object.assign(cfg, config || {});
		const regex: TagRegex = {
			closedTag: null,
			openTag: null
		};
	
		let unparseComments = false;
		const tags = ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source', 'math']
			.filter(name => !cfg.includeTags || !cfg.includeTags.includes(name))
			.concat(cfg.excludeTags || [])
			.filter((tag, i, arr) => {
				if (tag === 'comment') unparseComments = true;
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
	
	}

	/**
	 * Parse {{{parameter}}}s in a wikitext.
	 * 
	 * @param wikitext Input wikitext.
	 * @param config Optional object to specify tags inside which parameters should (not) be parsed.
	 */
	static parseParametersInWikitext(wikitext: string, config?: TagConfig): string[] {

		config = config || {};

		// Temporarily replace tags that prevent transclusions with `$TAGn`
		let content = wikitext;
		const regex = config._tagRegex || Template.#createTagRegex(config);
		const tags: string[] = [];
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
		const params: string[] = [];
		let exe: RegExpExecArray | null;
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
						} else {
							pos += m[0].length - 1;
							rightBraceCnt += m[0].length;
						}
					}
				}
			}
			content = content.slice(content.indexOf(para) + para.length);
			if (grammatical) {
				params.push(para);
			} else {
				log(`Unparsable parameter: ${para}`);
			}
			
		}

		// Get tags back
		params.forEach((para, i) => {
			params[i] = para.replace(/\$TAG\d+\$/g, (m) => {
				const n = m.match(/(\d+)\$$/);
				const idx = parseInt(n![1]);
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
	static parseWikitext(wikitext: string, config?: TemplateConfig) {

		let ret: Template[] = [];
		if (!/\{\{|\}\}/.test(wikitext)) {
			return ret;
		}

		const cfg: TemplateConfig = {
			includeTags: [],
			excludeTags: []
		};
		Object.assign(cfg, config || {});

		// Create tag regex
		const regex = Template.#createTagRegex({includeTags: cfg.includeTags, excludeTags: cfg.excludeTags});

		// Parse {{{parameter}}}s
		const para = Template.parseParametersInWikitext(wikitext, {_tagRegex: regex});

		let numUnclosed = 0;
		let startIdx = 0;
		let args: ParsedArgument[] = [];

		// Character-by-character loop
		for (let i = 0; i < wikitext.length; i++) {

			const wkt = wikitext.slice(i);

			// Skip certain expressions
			let m: RegExpMatchArray|null;
			if (para[0] && wkt.indexOf(para[0]) === 0) { // Parameter
				i += para[0].length - 1;
				if (numUnclosed !== 0) Template.#registerArgFragment(args, para[0], {nonname: true});
				para.shift();
				continue;
			} else if (regex.closedTag && (m = wkt.match(regex.closedTag))) { // Transclusion-preventing tags (could be self-closing)
				i += m[0].length - 1;
				if (numUnclosed !== 0) Template.#registerArgFragment(args, m[0], {nonname: true});
				continue;
			} else if (regex.openTag && (m = wkt.match(regex.openTag))) { // Open tags
				break;
			} else if ((m = wkt.match(/^\[\[.*?\]\]/))) { // Wikilink
				i += m[0].length - 1;
				if (numUnclosed !== 0) Template.#registerArgFragment(args, m[0], {nonname: true});
				continue;
			}

			if (numUnclosed === 0) { // We are not in a template
				if (/^\{\{/.test(wkt)) { // Found the start of a template
					startIdx = i;
					args = [];
					numUnclosed += 2;
					i++;
				}
			} else if (numUnclosed === 2) { // We are looking for closing braces
				if (/^\{\{/.test(wkt)) { // Found a nested template
					numUnclosed += 2;
					i++;
					Template.#registerArgFragment(args, '{{');
				} else if (/^\}\}/.test(wkt)) { // Found the end of the template
					const name = args[0] ? args[0].name : '';
					const fullname = args[0] ? args[0].text : '';
					const endIdx = i + 2;
					const text = wikitext.slice(startIdx, endIdx);
					const t = Template.#newFromParsed(name, fullname, args.slice(1), text, startIdx, endIdx);
					if (!cfg.namePredicate || cfg.namePredicate(name)) {
						if (!cfg.templatePredicate || cfg.templatePredicate(t)) {
							ret.push(t);
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
				} else { // Just part of the template
					Template.#registerArgFragment(args, wkt[0], wkt[0] === '|' ? {new: true} : {});
				}
			} else { // We are in a nested template
				let fragment;
				if (/^\{\{/.test(wkt)) { // Found another nested template
					fragment = '{{';
					numUnclosed += 2;
					i++;
				} else if (/^\}\}/.test(wkt)) { // Found the end of the nested template
					fragment = '}}';
					numUnclosed -= 2;
					i++;
				} else { // Just part of the nested template
					fragment = wkt[0];
				}
				Template.#registerArgFragment(args, fragment);
			}

		}

		return ret;

	}

	/**
	 * Incrementally register template arguments (character by character). This method has no return value, and the original array
	 * passed as `args` is modified.
	 * 
	 * The `args` array will consist of:
	 * ```
	 * const [name, params] = args;
	 * ```
	 * meaning that `args[0]` will store the name of the template. For `args[0]`, `text` is the whole of the name slot (which could
	 * contain redundant strings in cases like `{{Template<!--1-->|arg1=}}`, and `name` is its clean counterpart.
	 * 
	 * The other elements will be the parameters of the template, and each of the `text` properties starts with a pipe character (e.g. `|1=`).
	 * Note also that `args[1+].name` properties also have a leading pipe to be stripped (e.g. `|1`) because the parser would otherwise face
	 * problems if an unnamed argument has a value that starts with `=` (e.g. `{{Template|=}}`).
	 * 
	 * @param args Pass-by-reference array that stores the arguments of the template that is getting parsed.
	 * @param fragment Character(s) to register into the `args` array.
	 * @param options Optional object that characterizes the fragment.
	 */
	static #registerArgFragment(args: ParsedArgument[], fragment: string, options?: FragmentOptions): void {
		options = options || {};
		const len = options.new ? args.length : Math.max(args.length - 1, 0);
		if (args[len] === undefined) {
			args[len] = {text: '', name: '', value: ''};
		}
		let frIdx;
		if (len === 0 && options.nonname) { // Looking for a template name but the fragment is an unusual expression
			args[len].text += fragment;
		} else if (len === 0) { // Looking for a template name and the fragment is part of the name
			args[len].text += fragment;
			args[len].name += fragment;
		} else if ((frIdx = fragment.indexOf('=')) !== -1 && !args[len].name && !options.nonname) { // Found `=` when `name` is empty 
			args[len].name = args[len].text + fragment.slice(0, frIdx);
			args[len].text += fragment;
			args[len].value = args[len].text.slice(args[len].name.length + 1);
		} else {
			args[len].text += fragment;
			args[len].value += fragment;
		}
	}

	/**
	 * Name of the page that is to be transcluded. Should not contain anything but a page title.
	 */
	readonly name: string;
	/**
	 * Full string that fits into the first slot of the template (`{{fullName}}`). May be accompanied by additional
	 * characters that are not relevant to the title of the page to be transcluded.
	 */
	readonly fullName: string;
	/**
	 * `name` formatted by `Title.newFromText`.
	 */
	readonly cleanName: string;
	/**
	 * `cleanName` replacing `name` in `fullName`;
	 */
	readonly fullCleanName: string;
	/**
	 * Stores template arguments.
	 */
	readonly args: TemplateArgument[];
	/**
	 * Stores template argument keys.
	 */
	readonly keys: string[]; 
	/**
	 * Stores overridden template arguments.
	 */
	readonly overriddenArgs: TemplateArgument[];
	/**
	 * Original text fetched by `parseWikitext`.
	 */
	#originalText: string|null;
	/**
	 * Start and end indexes fetched by `parseWikitext`.
	 */
	#index: {
		start: number|null;
		end: number|null;
	};

	/**
	 * Initialize a new `Template` instance.
	 * 
	 * @param name Name of the page that is to be transcluded. Should not contain anything but a page title.
	 * @param fullname Full string that should fit into the first slot of the template (`{{fullname}}`), **excluding** 
	 * double braces. May contain whitespace characters (`{{ fullname }}`) and/or expressions that are not part of the
	 * template name (`{{ <!--name-->fullname }}`, `{{ {{{|safesubst:}}}fullname }}`, `{{ fullname \n}}`).
	 * @throws When `fullname` does not contain `name` as a substring.
	 */
	constructor(name: string, fullname?: string) {

		this.name = name;
		this.fullName = fullname || name;
		this.args = [];
		this.keys = [];
		this.overriddenArgs = [];
		if (!this.fullName.includes(this.name)) {
			throw new Error(`fullname ("${this.fullName}") does not contain name ("${this.name}") as a substring.`);
		}
		this.#originalText = null;
		this.#index = {
			start: null,
			end: null
		};

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
	 * Initialize a new `Template` instance from the result of `parseWikitext`.
	 */
	static #newFromParsed(name: string, fullname: string, args: ParsedArgument[], text: string, startIndex: number, endIndex: number): Template {
		const t = new Template(name, fullname);
		t.addArgs(args.map((obj) => ({'name': obj.name.replace(/^\|/, ''), value: obj.value})));
		t.#originalText = text;
		t.#index = {
			start: startIndex,
			end: endIndex
		};
		return t;
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
	#registerArgs(newArgs: NewArgsArray, logOverride: boolean) {
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

			const arg: TemplateArgument = {name, value, text, ufname, ufvalue, uftext, unnamed};
			this.#registerArg(arg, logOverride);

		});
	}

	/**
	 * @param arg New argument object to register.
	 * @param logOverride Whether to leave a log when overriding argument values.
	 */
	#registerArg(arg: TemplateArgument, logOverride: boolean) {
		const idx = this.keys.indexOf(arg.name);
		if (arg.unnamed) {
			for (let i = 1; i < Infinity; i++) {
				if (!this.keys.includes(i.toString())) {
					arg.name = i.toString();
					break;
				}
			}
		} else if (logOverride && idx !== -1) {
			this.overriddenArgs.push(this.args[idx]);
			this.keys.splice(idx, 1);
			this.args.splice(idx, 1);
		}
		this.keys.push(arg.name);
		this.args.push(arg);
	}

	/**
	 * Add new arguments to the `Template` instance. This method leaves a log when argument override takes place,
	 * which can be viewed by `getOverriddenArgs`.
	 * 
	 * @param newArgs An array of `{name: string; value: string;}` objects.
	 */
	addArgs(newArgs: NewArgsArray) {
		this.#registerArgs(newArgs, true);
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
	addArg(name: string, value: string) {
		this.#registerArgs([{name, value}], true);
	}

	/**
	 * Add template arguments from a raw text (e.g. `|1=v1|2=v2`).
	 * 
	 * @param argText String starting with a pipe character ("|").
	 * @throws When `argText` does not start with a pipe character.
	 */
	addArgsFromText(argText: string) {
		if (argText[0] !== '|') {
			throw new Error(`String passed to addArgsFromText must start with a pipe character (input: "${argText}")`);
		}
		const tmpl = Template.parseWikitext('{{' + argText + '}}', {recursivePredicate: () => false})[0];
		for (let i = 0; i < tmpl.overriddenArgs.length; i++) {
			const oArg = tmpl.overriddenArgs[i];
			this.overriddenArgs.push(oArg);
		}
		for (let i = 0; i < tmpl.args.length; i++) {
			this.#registerArg(tmpl.args[i], true);
		}
	}

	/**
	 * Set (or update) arguments in(to) the `Template` instance. This method does not leave a log when argument override takes place.
	 * 
	 * Note: New arguments are simply newly added, just as when `addArgs` is used. 
	 * 
	 * @param newArgs An array of `{name: string; value: string;}` objects.
	 */
	setArgs(newArgs: NewArgsArray) {
		this.#registerArgs(newArgs, false);
	}

	/**
	 * Set (or update) an argument in(to) the `Template` instance. This method does not leave a log when argument override takes place.
	 * 
	 * @param name An empty string may be passed for automatic argument numbering.
	 * @param value A `\n` character may follow when the argument should have a linebreak before the next argument or `}}`.
	 */
	setArg(name: string, value: string) {
		this.#registerArgs([{name, value}], false);
	}

	/**
	 * Get template arguments as an array of objects. The array is passed by reference, meaning that modifying it will change the
	 * original array stored in the `Template` instance. To prevent this, make a deep copy using `Array.prototype.slice`.
	 */
	getArgs(): TemplateArgument[] {
		return this.args;
	}

	/**
	 * Get an argument value as an object, from an argument name. 
	 * @param name Argument name.
	 * @param options Optional search options.
	 * @returns `null` if no argument is found with the specified name.
	 */
	getArg(name: string|RegExp, options?: ArgumentSearchOptions & {
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
	hasArg(name: string|RegExp, options?: ArgumentSearchOptions): boolean {
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
	 * If you need the raw wikitext found by `parseWikitext`, use `renderOriginal`. Note that `toString` or
	 * `render({nameprop: 'full', unformatted: true})` returns a similar result, except that these two methods
	 * do not render duplicate arguments, unlike `renderOriginal`.
	 * 
	 * @param options Optional object of rendering specifications
	 */
	render(options?: TemplateRenderOptions): string {

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
	 * Render the original template text.
	 * @returns `string` only when the instance is created by `parseWikitext`, or else `null`.
	 */
	renderOriginal(): string|null {
		return this.#originalText;
	}

	/**
	 * Find the original template in a wikitext and replace it with the (updated) template. This method works only when
	 * the instance was created by `parseWikitext`.
	 * @param wikitext Wikitext in which to search for the original template.
	 * @param options Optional template rendering options.
	 * @returns New wikitext with the original template replaced.
	 */
	replace(wikitext: string, options?: TemplateRenderOptions & {
		/**
		 * If `true`, use the start and end indexes of the original template in the wikitext passed to `parseWikitext`,
		 * and replacement takes place only if the replacee template has the same indexes in `wikitext`. This prevents
		 * an unparsed template in a transclusion-preventing expression from being wrongly replaced. Note that when `replace`
		 * is called recursively with this option specified as `true`, the looped array needs to be reversed because the
		 * indexes change after the replacement.
		 */
		useIndex?: boolean;
		/**
		 * Replace the original template with this string, instead of the rendering result of the `Template` instance.
		 */
		replacer?: string;
	}): string {

		options = options || {};
		const useIndex = !!options.useIndex;
		const replacer = typeof options.replacer === 'string' ? options.replacer : this.render(options);

		if (typeof this.#originalText === 'string') {
			if (!useIndex) {
				return wikitext.replace(this.#originalText, replacer);
			} else if (wikitext.slice(this.#index.start!, this.#index.end!) === this.#originalText) {
				let chunk1 = wikitext.slice(0, this.#index.start!);
				const chunk2 = replacer;
				let chunk3 = wikitext.slice(this.#index.end!);
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
	toString(): string {
		return this.render({nameprop: 'full', unformatted: true});
	}

	/**
	 * Get class properties in a JSON format.
	 */
	toJSON(): {
		name: string;
		fullName: string;
		cleanName: string;
		fullCleanName: string;
		args: TemplateArgument[];
		overriddenArgs: TemplateArgument[];
	} {
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