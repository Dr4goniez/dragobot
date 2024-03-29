import {
	Template,
	ArgumentHierarchy,
	TemplateJSON,
	RenderOptions
} from './template';
import { byteLength } from './string';
import { getMw } from './mw';
import { log } from './server';
import { ApiResponse, ApiResponseError } from '.';
import { clean } from './lib';

// ************************************************ PARSED TEMPLATE CLASS ************************************************

/** 
 * The object that is passed to {@link ParsedTemplate.constructor}.
 */
interface ParsedTemplateParam extends ArgumentHierarchy {
	name: string;
	fullName: string;
	args: ParsedArgument[];
	text: string;
	startIndex: number;
	endIndex: number;
	nestLevel: number;
}

/** Part of the object passed to the second parameter of {@link ParsedTemplate.replaceIn}. */
interface ReplaceInOptions {
	/**
	 * Replace the original template with this string.
	 *
	 * Default: {@link ParsedTemplate.render}(options)
	 */
	with?: string;
	/**
	 * If `true` (default), replacement takes place only if the passed wikitext has the original template
	 * starting at {@link ParsedTemplate._startIndex} and ending (exclusively) at {@link ParsedTemplate._endIndex}.
	 * This prevents a nonparsed template in a transclusion-preventing tag from being wrongly replaced
	 * ({@link Wikitext.parseTemplates} does not parse templates inside the relevant tags).
	 * ```
	 * const wikitext = '<!--{{Template}}-->\n{{Template}}'; // The second one is parsed
	 * const Wkt = new Wikitext(wikitext);
	 * const Temps = Wkt.parseTemplates(); // Temps[0]: ParsedTemplate, Temps[1]: undefined
	 * const newWikitext1 = Temps[0].replaceIn(wikitext, {with: ''});
	 * const newWikitext2 = Temps[0].replaceIn(wikitext, {with: '', useIndex: false});
	 * console.log(newWikitext1); // '<!--{{Template}}-->', expected result
	 * console.log(newWikitext2); // '<!---->\n{{Template}}', unexpected result
	 * ```
	 */
	useIndex?: boolean;
}

/** Class used by {@link Wikitext.parseTemplates}. */
export class ParsedTemplate extends Template {

	/**
	 * The original text of the template.
	 * @readonly
	 */
	readonly originalText: string;
	/**
	 * **CAUTION**: Pseudo-private property. Use {@link getStartIndex} to get this property's value.
	 * 
	 * The index to the start of the template in the wikitext out of which the template was parsed.
	 * 
	 * Note that this property is made private-like because it shouldn't be modified externally, but sometimes
	 * {@link Wikitext.parseTemplates} needs to modify this property, from outside this class.
	 */
	_startIndex: number;
	/**
	 * **CAUTION**: Pseudo-private property. Use {@link getEndIndex} to get this property's value.
	 * 
	 * The index up to, but not including, the end of the template in the wikitext out of which the template was parsed.
	 * 
	 * Note that this property is made private-like because it shouldn't be modified externally, but sometimes
	 * {@link Wikitext.parseTemplates} needs to modify this property, from outside this class.
	 */
	_endIndex: number;
	/**
	 * The nest level of the template. If not nested by other templates, the value is `0`.
	 */
	readonly nestLevel: number;

	/**
	 * Initialize a new {@link ParsedTemplate} instance. **This constructor is not supposed to be used externally**.
	 * @param parsed
	 * @throws {Error} When `name` has inline `\n` characters or when `fullName` does not contain `name` as a substring.
	 */
	constructor(parsed: ParsedTemplateParam) {
		const {name, fullName, args, text, startIndex, endIndex, hierarchy, nestLevel} = parsed;
		super(name, {fullName, hierarchy});
		this.addArgs(args.map((obj) => ({'name': obj.name.replace(/^\|/, ''), value: obj.value.replace(/^\|/, '')})));
		this.originalText = text;
		this._startIndex = startIndex;
		this._endIndex = endIndex;
		this.nestLevel = nestLevel;
	}

	/**
	 * Error-proof constructor. **This method is supposed to be used only by {@link Wikitext.parseTemplates}**.
	 * @param parsed
	 * @returns `null` if the constructor threw an error.
	 */
	static new(parsed: ParsedTemplateParam): ParsedTemplate|null {
		try {
			return new ParsedTemplate(parsed);
		}
		catch (err) {
			return null;
		}
	}

	/**
	 * Get class properties in a JSON format.
	 */
	toJSON(): TemplateJSON & { // Overrides `Template.toJSON`
		originalText: string;
		startIndex: number;
		endIndex: number;
		nestLevel: number;
	} {
		return {
			name: this.name,
			fullName: this.fullName,
			cleanName: this.cleanName,
			fullCleanName: this.fullCleanName,
			args: this.args.map(obj => ({...obj})),
			keys: this.keys.slice(),
			overriddenArgs: this.overriddenArgs.map(obj => ({...obj})),
			hierarchy: this.hierarchy.map(arr => [...arr]),
			originalText: this.originalText,
			startIndex: this._startIndex,
			endIndex: this._endIndex,
			nestLevel: this.nestLevel
		};
	}

	/**
	 * Render the original template text.
	 * @returns
	 */
	renderOriginal(): string {
		return this.originalText;
	}

	/**
	 * Get {@link _startIndex}.
	 * @returns
	 */
	getStartIndex(): number {
		return this._startIndex;
	}

	/**
	 * Get {@link _endIndex}.
	 * @returns
	 */
	getEndIndex(): number {
		return this._endIndex;
	}

	/**
	 * Get the nest level of the template.
	 * @returns
	 */
	getNestLevel(): number {
		return this.nestLevel;
	}

	/**
	 * Find the original template in a wikitext and replace it with the (updated) template obtained by
	 * {@link render}. This method is supposed to be called on a wiktiext same as the one from which the
	 * {@link ParsedTemplate} instance was parsed and initialized.
	 * 
	 * Note that if this method is called recursively against an array of {@link ParsedTemplate}, the looped array needs to be
	 * reversed so that the replacement takes place from the bottom of the wikitext. This is because the method reads the start
	 * and end indexes of the original template before the replacement (unless {@link ReplaceInOptions.useIndex|useIndex} is set
	 * to `false`), and if the replacement is done in a top-down fashion, the indexes change and the subsequent replacements are
	 * affected.
	 *
	 * @param wikitext Wikitext in which to search for the original template.
	 * @param options Optional object to specify rendering and replacement options.
	 * @returns New wikitext with the original template replaced. (Could be the same as the input wikitext if the replacement
	 * didn't take place.)
	 */
	replaceIn(wikitext: string, options?: RenderOptions & ReplaceInOptions): string {

		const cfg = Object.assign({useIndex: true}, options || {});
		const replacer = typeof cfg.with === 'string' ? cfg.with : this.render(cfg);

		if (!cfg.useIndex) {
			return wikitext.replace(this.originalText, replacer);
		} else if (wikitext.slice(this._startIndex, this._endIndex) === this.originalText) {
			let chunk1 = wikitext.slice(0, this._startIndex);
			const chunk2 = replacer;
			let chunk3 = wikitext.slice(this._endIndex);
			const hasLineBreak = /\n[^\S\n\r]*$/.test(chunk1) || /^[^\S\n\r]*\n[^\S\n\r]*/.test(chunk3);
			if (replacer === '' && hasLineBreak) {
				chunk1 = chunk1.trim();
				chunk3 = (chunk1 !== '' ? '\n' : '') + chunk3.trim();
			}
			return chunk1 + chunk2 + chunk3;
		} else {
			return wikitext;
		}

	}

}

// ************************************************ WIKITEXT CLASS ************************************************

/** The object that stores revision information fetched by {@link Wikitext.fetch}. */
interface Revision {
	/** The ID of the page. */
	pageid: number;
	/** The ID of the current revision. */
	revid: number;
	/** The namespace number of the page. */
	ns: number;
	/** The formatted title of the page. */
	title: string;
	/** The JSON timestamp of the current revision. */
	basetimestamp: string;
	/** The JSON timestamp of the API request. */
	curtimestamp: string;
	/** The byte length of the page content. */
	length: number;
	/** The content of the page. */
	content: string;
	/** Whether the page is a redirect. */
	redirect: boolean;
}

/** The object that is an element of the return array of {@link Wikitext.parseTags}. */
interface Tag {
	/**
	 * The name of the tag in lowercase (for `<!---->` tags, the name is `comment`).
	 */
	name: string;
	/**
	 * The whole text of the tag (i.e. outerHTML).
	 */
	text: string;
	/**
	 * The text inside the tag (i.e. innerHTML).
	 */
	innerText: string;
	/**
	 * Whether the tag closes itself. For comments, `true` for empty ones (i.e. `<!---->`), `false` otherwise.
	 */
	selfClosed: boolean;
	/**
	 * Whether the tag is unclosed.
	 */
	unclosed: boolean;
	/**
	 * The index to the start of the tag in the wikitext.
	 */
	startIndex: number;
	/**
	 * The index up to, but not including, the end of the tag in the wikitext.
	 */
	endIndex: number;
	/**
	 * The nest level of the tag (`0` if not inside any parent tag).
	 */
	nestLevel: number;
}
/** The parsing config of {@link Wikitext.parseTags}. */
interface ParseTagsConfig {
	/**
	 * Only include \<tag>s that match this predicate.
	 * @param tag
	 * @returns
	 */
	conditionPredicate?: (tag: Tag) => boolean;
}

/** The object that is an element of the return array of {@link Wikitext.parseSections}. */
interface Section {
	/**
	 * The title of the section. Could be different from the result of `action=parse` if it contains HTML tags or templates.
	 * For the top section, the value is `top`.
	 */
	title: string;
	/**
	 * `==heading==` or the outerHTML of a heading element. Any leading/trailing `\s`s are trimmed.
	 * For the top section, the value is empty.
	 */
	heading: string;
	/**
	 * The level of the section (1 to 6). For the top section, the value is `1`.
	 */
	level: number;
	/**
	 * The index number of the section. This is the same as the `section` parameter of {@link https://www.mediawiki.org/wiki/API:Edit |the edit API}.
	 * For the top section, the value is `0`.
	 */
	index: number;
	/**
	 * The index to the start of the section in the wikitext.
	 */
	startIndex: number;
	/**
	 * The index up to, but not including, the end of the section in the wikitext.
	 */
	endIndex: number;
	/**
	 * The content of the section including the heading.
	 */
	content: string;
}

/** The object that is an element of the return array of {@link Wikitext.parseParameters}. */
interface Parameter {
	/**
	 * The entire text of the parameter.
	 */
	text: string;
	/**
	 * The index to the start of the parameter in the wikitext.
	 */
	startIndex: number;
	/**
	 * The index up to, but not including, the end of the parameter in the wikitext.
	 */
	endIndex: number;
	/**
	 * The nest level of the parameter. For parameters that are not nested inside another parameter, the value is `0`.
	 */
	nestLevel: number;
}
/** The parsing config of {@link Wikitext.parseParameters}. */
interface ParseParametersConfig {
	/**
	 * Whether to parse {{{parameter}}}s inside another {{{parameter}}}.
	 *
	 * Default: `true`
	 */
	recursive?: boolean;
	/**
	 * Only include {{{parameter}}}s that match this predicate. Note that this predicate is evaluated after the {@link recursive} config.
	 * For this reason, it had better not specify both of the configs simultaneously, but rather include a condition to see if the callback
	 * function's parameter of {@link Parameter.nestLevel|nestLevel} has the value of `0`.
	 * @param parameter
	 * @returns
	 */
	conditionPredicate?: (parameter: Parameter) => boolean;
}

/** The parsing config of {@link Wikitext.parseTemplates}. */
interface ParseTemplatesConfig extends ArgumentHierarchy {
	/**
	 * Only parse templates whose names match this predicate.
	 * @param name The name of the parsed template, which is the same as {@link ParsedTemplate.getName}('clean')`.
	 */
	namePredicate?: (name: string) => boolean;
	/**
	 * Only parse templates whose {@link ParsedTemplate} instances match this predicate. Can be used together with
	 * {@link namePredicate}, although this predicate is evaluated after evaluating {@link namePredicate}.
	 * @param Template
	 */
	templatePredicate?: (Template: ParsedTemplate) => boolean;
	/**
	 * Parse nested templates in accordance with this predicate.
	 *
	 * Default: Always parse nested templates
	 * @param Template Can be `null` if {@link ParsedTemplate.constructor} has thrown an error.
	 */
	recursivePredicate?: (Template: ParsedTemplate|null) => boolean;
	/**
	 * Private parameter used to determine the value of {@link ParsedTemplate.nestLevel}.
	 * @private
	 */
	_nestLevel?: number;
}

/** The Wikitext class with methods to manipulate wikitext. */
export class Wikitext {

	/**
	 * The wikitext from which the {@link Wikitext} instance was initialized.
	 */
	readonly wikitext: string;
	/**
	 * Stores the return value of {@link Wikitext.fetch|fetch} when a {@link Wikitext} instance is created by {@link newFromTitle}.
	 *
	 * A deep copy can be retrieved by {@link getRevision}.
	 * @private
	 */
	private revision: Revision|null;
	/**
	 * Stores the return value of {@link parseTags}.
	 *
	 * A deep copy can be retrieved by {@link getTags}.
	 * @private
	 */
	private tags: Tag[]|null;
	/**
	 * Stores the return value of {@link parseSections}.
	 *
	 * A deep copy can be retrieved by {@link getSections}.
	 * @private
	 */
	private sections: Section[]|null;
	/**
	 * Stores the return value of {@link parseParameters}.
	 *
	 * A deep copy can be retrieved by {@link getParameters}.
	 * @private
	 */
	private parameters: Parameter[]|null;

	/**
	 * Initialize a {@link Wikitext} instance.
	 * @param wikitext
	 * @requires mediawiki.api
	 */
	constructor(wikitext: string) {
		this.wikitext = wikitext;
		this.revision = null;
		this.tags = null;
		this.sections = null;
		this.parameters = null;
	}

	/**
	 * Returns the length of the wikitext.
	 */
	get length(): number {
		return this.wikitext.length;
	}

	/**
	 * Returns the byte length of the wikitext.
	 */
	get byteLength(): number {
		const rev = this.getRevision();
		return rev && rev.length || byteLength(this.wikitext);
	}

	/**
	 * Fetch the wikitext of a page with additional information on the current revision.
	 * @param pagetitle
	 * @returns `false` if the page doesn't exist, `null` if the API request failed.
	 */
	static async fetch(pagetitle: string): Promise<Revision|false|null> {
		const mw = getMw();
		if (!mw) {
			log('Failed to get mw.');
			return null;
		}
		return mw.request({
			action: 'query',
			titles: pagetitle,
			prop: 'info|revisions',
			rvprop: 'ids|timestamp|content',
			rvslots: 'main',
			curtimestamp: 1,
			formatversion: 2
		}).then((res: ApiResponse) => {
			const resPgs = res && res.query && Array.isArray(res.query.pages) && res.query.pages[0];
			if (!resPgs) {
				return null;
			} else if (resPgs.missing) {
				return false;
			} else if (typeof resPgs.pageid !== 'number' || !resPgs.revisions || typeof res.curtimestamp !== 'string' || typeof resPgs.length !== 'number') {
				return null;
			} else {
				const ret: Revision = {
					pageid: resPgs.pageid,
					revid: resPgs.revisions[0].revid,
					ns: resPgs.ns,
					title: resPgs.title,
					basetimestamp: resPgs.revisions[0].timestamp,
					curtimestamp: res.curtimestamp,
					length: resPgs.length,
					content: resPgs.revisions[0].slots.main.content,
					redirect: !!resPgs.redirect
				};
				return ret;
			}
		}).catch((err: ApiResponseError) => {
			log(err.info);
			return null;
		});
	}

	/**
	 * Fetch the wikitext of a page. If additional revision information should be included, use {@link Wikitext.fetch|fetch}.
	 * @param pagetitle
	 * @returns `false` if the page doesn't exist, `null` if the API request failed.
	 */
	static async read(pagetitle: string): Promise<string|false|null> {
		const res = await Wikitext.fetch(pagetitle);
		return res && res.content;
	}

	/**
	 * Initialize a new {@link Wikitext} instance by fetching the content of a page.
	 * @param pagetitle
	 * @returns `false` if the page doesn't exist, `null` if the content of the page failed to be fetched.
	 */
	static async newFromTitle(pagetitle: string): Promise<Wikitext|false|null> {
		const revision = await Wikitext.fetch(pagetitle);
		if (!revision) {
			return revision;
		} else {
			const Wkt = new Wikitext(revision.content);
			Wkt.revision = revision;
			return Wkt;
		}
	}

	/**
	 * Get a deep copy of {@link revision}, which is a private property available only when the {@link Wikitext} instance was initialized
	 * by {@link newFromTitle}.
	 * @returns `null` if the instance doesn't have the relevant property, meaning that it wasn't initialized by {@link newFromTitle}.
	 */
	getRevision(): Revision|null {
		return this.revision && {...this.revision};
	}

	/**
	 * Parse \<tag>s in the wikitext.
	 * @param config
	 * @returns
	 */
	parseTags(config?: ParseTagsConfig): Tag[] {

		const cfg = config || {};
		if (this.tags) {
			return this.tags.reduce((acc: Tag[], obj) => {
				if (!cfg.conditionPredicate || cfg.conditionPredicate(obj)) {
					acc.push({...obj}); // Deep copy
				}
				return acc;
			}, []);
		}

		const wikitext = this.wikitext;
		let tags: Tag[] = [];
		/**
		 * HTML tags and whitespace
		 * ```html
		 * <foo   > <!-- No whitespace between "<" and the tag name -->
		 * </foo  > <!-- No whitespace between "</" and the tag name -->
		 * <foo  /> <!-- No whitespace in-between "/>" -->
		 * ```
		 */
		const regex = {
			/** Matches `<tag>`. (`$1`: tag name) */
			opening: /^<(?!\/)([^>\s]+)(?:\s[^>]*)?>/,
			/** Matches `</tag>`. (`$1`: tag name) */
			closing: /^<\/([^>\s]+)(?:\s[^>]*)?>/,
			/** Matches `/>`. */
			selfClosing: /\/>$/,
			/** Matches `<!--`. */
			commentOpening: /^<!--/,
			/** Matches `-->`. */
			commentClosing: /^-->/
		};
		/**
		 * Stores the last-found opening tag at index `0`.
		 * Once the opening of a comment tag is unshifted, no new opening tag is unshifted before the comment tag is shifted.
		 */
		const parsing: {name: string; index: number; innerIndex: number;}[] = [];
		/** Whether we are in a comment (i.e. `<!---->`). */
		const inComment = () => parsing[0] && parsing[0].name === 'comment';

		// Parse the wikitext, character by character
		for (let i = 0; i < wikitext.length; i++) {
			const wkt = wikitext.slice(i);
			let m;
			if (!inComment()) {
				if (regex.commentOpening.test(wkt)) { // Found an occurrence of <!--
					parsing.unshift({
						name: 'comment',
						index: i,
						innerIndex: i + 4
					});
					i += 3;
				} else if ((m = wkt.match(regex.opening))) { // Found an occurrence of <tag>
					const tagName = m[1].toLowerCase();
					if (regex.selfClosing.test(m[0])) { // Closing self
						tags.push({
							name: tagName,
							text: m[0],
							innerText: '',
							selfClosed: true,
							unclosed: false,
							startIndex: i,
							endIndex: i + m[0].length,
							nestLevel: parsing.length
						});
					} else { // Found a new tag
						parsing.unshift({
							name: tagName,
							index: i,
							innerIndex: i + m[0].length
						});
					}
					i += m[0].length - 1;
				} else if (parsing.length && (m = wkt.match(regex.closing))) { // Found an occurrence of </tag>
					const tagName = m[1].toLowerCase();
					let spliceCnt = 0;
					for (let j = 0; j < parsing.length; j++) { // Loop the `parsing` array until we find the corresponding opening tag
						const isSameTagName = parsing[j].name === tagName; // e.g. true when <span></span>, false when <span><div></span>
						const endIndex = isSameTagName ? i + m[0].length : i; // "<span></span>" or <span>"<div>"</span>
						tags.push({
							name: parsing[j].name,
							text: wikitext.slice(parsing[j].index, endIndex),
							innerText: wikitext.slice(parsing[j].innerIndex, endIndex - (isSameTagName ? m[0].length : 0)),
							selfClosed: false,
							unclosed: !isSameTagName,
							startIndex: parsing[j].index,
							endIndex: endIndex,
							nestLevel: parsing.length - 1
						});
						spliceCnt++;
						if (isSameTagName) {
							break;
						}
					}
					parsing.splice(0, spliceCnt);
					i += m[0].length - 1;
				}
			} else if (regex.commentClosing.test(wkt)) { // In comment and found "-->"
				const startIndex = parsing[0].index;
				const endIndex = i + 3;
				tags.push({
					name: 'comment',
					text: wikitext.slice(startIndex, endIndex),
					innerText: wikitext.slice(parsing[0].innerIndex, endIndex - 3),
					selfClosed: i - 4 === startIndex, // <!--|-->: The pipe is where the current index is at
					unclosed: false,
					startIndex: startIndex,
					endIndex: endIndex,
					nestLevel: parsing.length - 1
				});
				parsing.shift();
				i += 2;
			}
		}

		// Do we have any unclosed tag left?
		for (let i = 0; i < parsing.length; i++) {
			tags.push({
				name: parsing[i].name,
				text: wikitext.slice(parsing[i].index, wikitext.length),
				innerText: wikitext.slice(parsing[i].innerIndex, wikitext.length),
				selfClosed: false,
				unclosed: true,
				startIndex: parsing[i].index,
				endIndex: wikitext.length,
				nestLevel: parsing.length - 1 - i
			});
		}

		// Sort the parsed tags
		tags.sort((obj1, obj2) => {
			if (obj1.startIndex < obj2.startIndex && obj1.endIndex > obj2.endIndex) {
				return -1;
			} else if (obj1.startIndex < obj2.startIndex) {
				return -1;
			} else if (obj1.endIndex > obj2.endIndex) {
				return 1;
			} else {
				return 0;
			}
		});

		// Save the tags
		this.tags = tags.map(obj => ({...obj})); // Deep copy

		// Filter the result in accordance with the config
		if (cfg.conditionPredicate) {
			tags = tags.filter(Tag => cfg.conditionPredicate!(Tag));
		}

		return tags;

	}

	/**
	 * Get a deep copy of {@link tags}, which is a private property available only when {@link parseTags} has
	 * been called at least once. Note that {@link parseTags} returns a (filtered) deep copy of {@link tags}
	 * on a non-first call, so simply call the relevant method if there is no need for a `null` return.
	 * @returns
	 */
	getTags(): Tag[]|null {
		return this.tags && this.tags.map(obj => ({...obj}));
	}

	/**
	 * Check whether a substring of the wikitext starting and ending at a given index is inside any transclusion-preventing tag.
	 * @param tpTags An array of transclusion-preventing tags fetched by {@link parseTags}.
	 * @param startIndex The start index of the string in the wikitext.
	 * @param endIndex The end index of the string in the wikitext.
	 * @returns
	 */
	private inTpTag(tpTags: Tag[], startIndex: number, endIndex: number): boolean {
		return tpTags.some((obj) => obj.startIndex < startIndex && endIndex < obj.endIndex);
	}

	/**
	 * Parse sections in the wikitext.
	 * @returns
	 */
	parseSections(): Section[] {

		if (this.sections) {
			return this.sections.map(obj => ({...obj})); // Deep copy
		}

		// Get transclusion-preventing tags
		const tpTags = this.parseTags({
			conditionPredicate: (tag) => ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source', 'math'].includes(tag.name)
		});
		/**
		 * Remove `<!---->` tags from a string.
		 * @param str
		 * @returns
		 */
		const removeComments = (str: string): string => {
			tpTags.forEach(({name, text}) => {
				if (name === 'comment') {
					str = str.replace(text, '');
				}
			});
			return str;
		};

		// Define regular expressions
		/**
		 * Regular expression to parse out ==heading==s.
		 *
		 * Notes on the wiki markup of headings:
		 * - `== 1 ===`: `<h2>1 =</h2>`
		 * - `=== 1 ==`: `<h2>= 1</h2>`
		 * - `== 1 ==\S+`: Not recognized as the beginning of a section (but see below)
		 * - `== 1 ==<!--string-->`: `<h2>1</h2>`
		 * - `======= 1 =======`: `<h6>= 1 =</h6>`
		 *
		 * Capture groups:
		 * - `$1`: Left equals
		 * - `$2`: Heading text
		 * - `$3`: Right equals
		 * - `$4`: Remaining characters
		 *
		 * In `$4`, basically no character can appear, except:
		 * - `[\t\n\u0020\u00a0]` ( = `[\u0009\u000a\u0020\u00a0]`)
		 *
		 * Note that this is not the same as the JS `\s`, which is equivalent to
		 * `[\t\n\v\f\r\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]`.
		 */
		const rHeading = /^(={1,6})(.+?)(={1,6})([^\n]*)\n?$/gm;
		const rWhitespace = /[\t\u0020\u00a0]/g;

		// Get <heading>s
		interface Heading {
			/** The entire line of the heading, starting with `=`. Any leading/trailing `\s`s are trimmed. */
			text: string;
			/** The inner text of the heading. Could be different from the result of `action=parse` if it contains HTML tags or templates. */
			title: string;
			/** The level of the heading. */
			level: number;
			/** The index to the start of the heading in the wikitext. */
			index: number;
		}
		const headings = this.parseTags().reduce((acc: Heading[], obj) => {
			let m;
			if ((m = obj.name.match(/^h([1-6])$/)) && !obj.selfClosed && !this.inTpTag(tpTags, obj.startIndex, obj.endIndex)) {
				// The tag is a heading element, not self-closing, and not in a transclusion-preventing tag
				acc.push({
					text: obj.text,
					title: clean(removeComments(obj.innerText)),
					level: parseInt(m[1]),
					index: obj.startIndex
				});
			}
			return acc;
		}, []);

		// Parse ==heading==s
		let m;
		while ((m = rHeading.exec(this.wikitext))) {

			// If `$4` isn't empty or the ==heading== is inside a transclusion-preventing tag, the heading isn't the start of a section
			const m4 = m[4].replace(rWhitespace, '');
			if (m4 && removeComments(m4) || this.inTpTag(tpTags, m.index, m.index + m[0].length)) {
				continue;
			}

			// Validate the heading
			const level = Math.min(m[1].length, m[3].length); // The number of "="s (smallest)
			const title = clean(removeComments(
				'='.repeat(Math.max(0, m[1].length - level)) + // Add "="s if the left and right "="s don't count the same
				m[2] +
				'='.repeat(Math.max(0, m[3].length - level))
			));
			headings.push({
				text: m[0].trim(),
				title,
				level,
				index: m.index
			});

		}
		headings.sort((obj1, obj2) => obj1.index - obj2.index);
		headings.unshift({text: '', title: 'top', level: 1, index: 0}); // For the top section

		// Parse sections from the headings
		const wkt = this.wikitext;
		const sections: Section[] = headings.map(({text, title, level, index}, i, arr) => {
			const boundaryIdx =
				i === 0 ? // If this is the top section,
				(arr.length > 1 ? 1 : -1) :	// the next heading or else no boundary, otherwise
				arr.findIndex((obj, j) => j > i && obj.level <= level); // find a next non-subsection of this section
			const content = wkt.slice(
				index,
				boundaryIdx !== -1 ? arr[boundaryIdx].index : wkt.length // Up to the next heading or to the end of the entire wikitext
			);
			return {
				title,
				heading: text,
				level,
				index: i,
				startIndex: index,
				endIndex: index + content.length,
				content
			};
		});

		// Save the sections
		this.sections = sections.map(obj => ({...obj})); // Deep copy

		return sections;

	}

	/**
	 * Get a deep copy of {@link sections}, which is a private property available only when {@link parseSections} has
	 * been called at least once. Note that {@link parseSections} returns a (filtered) deep copy of {@link sections}
	 * on a non-first call, so simply call the relevant method if there is no need for a `null` return.
	 * @returns
	 */
	getSections(): Section[]|null {
		return this.sections && this.sections.map(obj => ({...obj}));
	}

	/**
	 * Parse {{{parameter}}}s in the wikitext.
	 * @param config
	 * @returns
	 */
	parseParameters(config?: ParseParametersConfig): Parameter[] {

		const cfg: ParseParametersConfig = Object.assign({recursive: true}, config || {});
		if (this.parameters) {
			return this.parameters.reduce((acc: Parameter[], obj) => {
				if (obj.nestLevel > 0 && !cfg.recursive) {
					return acc;
				}
				if (cfg.conditionPredicate && !cfg.conditionPredicate(obj)) {
					return acc;
				}
				acc.push({...obj}); // Deep copy
				return acc;
			}, []);
		}

		const tpTags = this.parseTags({
			conditionPredicate: (tag) => ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source', 'math'].includes(tag.name)
		});

		// Parse parameters from the left to the right
		const params: Parameter[] = [];
		let exe;
		const regex = /\{\{\{[^{][^}]*\}\}\}/g;
		const wikitext = this.wikitext;
		let nestLevel = 0;
		while ((exe = regex.exec(wikitext))) {

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
				let pos = exe.index + para.length - 3; // Get the end index of `{{{1|{{{page|{{PAGENAME` in `wikitext`
				rightBraceCnt -= 3;
				for (pos; pos < wikitext.length; pos++) { // Check what character comes at `_` in `{{{1|{{{page|{{PAGENAME_`
					const m = wikitext.slice(pos).match(/^\}{2,}/);
					if (m) { // `_` is a right brace followed by another
						if (leftBraceCnt <= rightBraceCnt + m[0].length) { // If the right braces close all the left braces
							const lastIndex = pos + (leftBraceCnt - rightBraceCnt);
							para = wikitext.slice(exe.index, lastIndex); // Get the correct parameter
							grammatical = true;
							regex.lastIndex = lastIndex; // Update the index at which to start the next match
							break;
						} else {
							pos += m[0].length - 1;
							rightBraceCnt += m[0].length;
						}
					}
				}
			}

			if (grammatical) {
				if (!this.inTpTag(tpTags, exe.index, regex.lastIndex)) {
					params.push({
						text: para,
						startIndex: exe.index,
						endIndex: regex.lastIndex,
						nestLevel
					});
					if (cfg.recursive && para.slice(3).includes('{{{')) {
						regex.lastIndex = exe.index + 3;
						nestLevel++;
					} else {
						nestLevel = 0;
					}
				}
			} else {
				log(`Unparsable parameter: ${para}`);
			}

		}

		// Save the parameters
		this.parameters = params.map(obj => ({...obj})); // Deep copy

		return params.reduce((acc: Parameter[], obj) => {
			if (obj.nestLevel > 0 && !cfg.recursive) {
				return acc;
			}
			if (cfg.conditionPredicate && !cfg.conditionPredicate(obj)) {
				return acc;
			}
			acc.push(obj);
			return acc;
		}, []);

	}

	/**
	 * Get a deep copy of {@link parameters}, which is a private property available only when {@link parseParameters} has
	 * been called at least once. Note that {@link parseParameters} returns a (filtered) deep copy of {@link parameters}
	 * on a non-first call, so simply call the relevant method if there is no need for a `null` return.
	 * @returns
	 */
	getParameters(): Parameter[]|null {
		return this.parameters && this.parameters.map(obj => ({...obj}));
	}

	/**
	 * Parse {{template}}s in the wikitext.
	 * @param config
	 * @returns
	 */
	parseTemplates(config?: ParseTemplatesConfig): ParsedTemplate[] {

		const cfg = Object.assign({_nestLevel: 0}, config || {});
		const tpTags = this.parseTags({
			conditionPredicate: (tag) => ['comment', 'nowiki', 'pre', 'syntaxhighlight', 'source', 'math'].includes(tag.name)
		});
		const params = this.parseParameters({recursive: false});

		let numUnclosed = 0;
		let startIdx = 0;
		let args: ParsedArgument[] = [];

		// Character-by-character loop
		const wikitext = this.wikitext;
		let ret: ParsedTemplate[] = [];
		for (let i = 0; i < wikitext.length; i++) {

			const wkt = wikitext.slice(i);

			// Skip certain expressions
			let idx: number;
			let m: RegExpMatchArray|null;
			if ((idx = tpTags.findIndex(obj => obj.startIndex === i)) !== -1) { // Transclusion-preventing tag
				const {text} = tpTags[idx];
				if (numUnclosed !== 0) processArgFragment(args, text, {nonname: true});
				tpTags.splice(0, idx + 1);
				i += text.length - 1;
				continue;
			} else if ((idx = params.findIndex(obj => obj.startIndex === i)) !== -1) { // Parameter
				const {text} = params[idx];
				if (numUnclosed !== 0) processArgFragment(args, text, {nonname: true});
				params.splice(0, idx + 1);
				i += text.length - 1;
				continue;
			} else if ((m = wkt.match(/^\[\[[^[\]]*?\]\]/))) { // Wikilink
				i += m[0].length - 1;
				if (numUnclosed !== 0) processArgFragment(args, m[0], {nonname: true});
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
					processArgFragment(args, '{{');
				} else if (/^\}\}/.test(wkt)) { // Found the end of the template
					const name = args[0] ? args[0].name : '';
					const fullName = args[0] ? args[0].text : '';
					const endIdx = i + 2;
					const text = wikitext.slice(startIdx, endIdx);
					const t = ParsedTemplate.new({
						name,
						fullName,
						args: args.slice(1),
						text,
						startIndex: startIdx,
						endIndex: endIdx,
						hierarchy: cfg.hierarchy,
						nestLevel: cfg._nestLevel
					});
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
							const nested = new Wikitext(inner).parseTemplates(Object.assign(cfg, {_nestLevel: ++cfg._nestLevel}));
							if (nested.length) {
								nested.forEach((Temp) => {
									Temp._startIndex += startIdx + 2;
									Temp._endIndex += startIdx + 2;
								});
								ret = ret.concat(nested);
							}
							cfg._nestLevel = 0;
						}
					}
					numUnclosed -= 2;
					i++;
				} else { // Just part of the template
					processArgFragment(args, wkt[0], wkt[0] === '|' ? {new: true} : {});
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
				processArgFragment(args, fragment);
			}

		}

		return ret;

	}

}

// ************************************************ HELPER FUNCTION FOR WIKITEXT CLASS ************************************************

export interface ParsedArgument {
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
interface FragmentOptions {
	/** Whether the passed fragment can be part of the name of the template. */
	nonname?: boolean;
	/** Whether the passed fragment starts a new template argument. */
	new?: boolean;
}
/**
 * Incrementally process fragments of template arguments. This function has no return value, and the original array
 * passed as {@link args} is modified.
 *
 * The {@link args} array will consist of:
 * ```
 * const [name, ...params] = args;
 * ```
 * meaning that `args[0]` will store the name of the template. For `args[0]`, `text` is the whole of the name slot (which could
 * contain redundant strings in cases like `{{Template<!--1-->|arg1=}}`, and `name` is its clean counterpart.
 *
 * The other elements will be the arguments of the template, and each of the `text` properties starts with a pipe character (e.g. `|1=`).
 * Note also that `args[1+].name` properties also have a leading pipe to be stripped (e.g. `|1`) because the parser would otherwise face
 * problems if an unnamed argument has a value that starts with `=` (e.g. `{{Template|=}}`).
 *
 * @param args Pass-by-reference array that stores the arguments of the template that is getting parsed.
 * @param fragment Character(s) to register into the {@link args} array.
 * @param options Optional object that characterizes the fragment.
 */
function processArgFragment(args: ParsedArgument[], fragment: string, options?: FragmentOptions): void {
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