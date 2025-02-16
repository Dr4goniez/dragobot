export class WikitextE {

	/**
	 * The main wikitext content of a WikitextE instance.
	 *
	 * This should be read-only, but the class internally needs to be able to update it;
	 * hence the private property. Use {@link content} to get a copy of this property.
	 */
	private _content: string;

	/**
	 * HTML tags parsed from the wikitext.
	 *
	 * Use {@link tags} to get a deep copy of this property.
	 */
	private _tags: Tag[];

	constructor(content: string) {
		this._content = content;

		// Parse the wikitext for HTML tags as soon as the instance is initialized,
		// because they are necessary for other parsing operations
		this._tags = WikitextE.parseTags(content);
	}

	/**
	 * Returns the wikitext content of the instance.
	 */
	get content(): string {
		return this._content;
	}

	/**
	 * Returns a deep copy of the parsed HTML tags.
	 */
	get tags(): Tag[] {
		return this._tags.map((obj) => Object.create(
			Object.getPrototypeOf(obj),
			Object.getOwnPropertyDescriptors(obj)
		));
	}

	/**
	 * Regular expressions for matching HTML tags (including comment tags).
	 *
	 * Accepted formats:
	 * ```html
	 * <foo >	<!-- No whitespace between "<" and "foo" -->
	 * </foo >	<!-- No whitespace between "<" and "/" -->
	 * <foo />	<!-- No whitespace between "/" and ">" -->
	 * ```
	 */
	private static readonly tagRegex = {
		/**
		 * Matches a start tag.
		 * * `$0`: The full start tag (e.g. `<!--` or `<tag>`)
		 * * `$1`: `--` (undefined for normal tags)
		 * * `$2`: `tag` (undefined for comment tags)
		 *
		 * NOTE: This regex also matches self-closing tags.
		 */
		start: /^<!(--)|^<(?!\/)([^>\s]+)(?:\s[^>]*)?>/,
		/**
		 * Matches an end tag.
		 * * `$0`: The full end tag (e.g. `-->` or `</tag>`)
		 * * `$1`: `--` (undefined for normal tags)
		 * * `$2`: `tag` (undefined for comment tags)
		 */
		end: /^(--)>|^<\/([^>\s]+)(?:\s[^>]*)?>/,
		/**
		 * Matches the names of void tags. `<source>` is excluded because it is not considered void in wikitext.
		 * @see https://developer.mozilla.org/en-US/docs/Glossary/Void_element
		 */
		void: /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|track|wbr)$/,
		/**
		 * Matches a self-closing tag.
		 */
		self: /\/>$/,
	};

	/**
	 * Parse a wikitext for HTML tags.
	 * @param wikitext
	 * @returns
	 */
	private static parseTags(wikitext: string): Tag[] {

		/**
		 * Array to store unclosed start tags that need matching end tags
		 */
		const startTags: StartTag[] = [];

		// Parse the wikitext string by checking each character
		const parsed: Tag[] = [];
		let m;
		for (let i = 0; i < wikitext.length; i++) {

			const wkt = wikitext.slice(i);

			// If a start tag is found
			if ((m = WikitextE.tagRegex.start.exec(wkt))) {

				const nodeName = (m[1] || m[2]).toLowerCase();
				const selfClosing = WikitextE.tagRegex.self.test(m[0]);

				// Check if the tag is a void tag
				if (WikitextE.tagRegex.void.test(nodeName)) {
					parsed.push(
						createVoidTagObject(nodeName, m[0], i, startTags.length, selfClosing)
					);
				} else {
					// For non-void tags, store the start tag for later matching with end tags
					// NOTE: Self-closing tags are invalid in HTML and the trailing slash character is ignored
					// i.e., they still require a closing tag unless they are void tags.
					startTags.unshift({
						name: nodeName,
						startIndex: i,
						endIndex: i + m[0].length,
						selfClosing: WikitextE.tagRegex.self.test(m[0])
					});
				}

				// Skip ahead by the length of the matched tag to continue parsing
				i += m[0].length - 1;

			} else if ((m = WikitextE.tagRegex.end.exec(wkt))) {

				// If an end tag is found, attempt to match it with the corresponding start tag
				const nodeName = (m[1] || m[2]).toLowerCase();
				const endTag = m[0];

				// Closed void tags like </br> are tricky: They just work as start tags like <br>
				if (WikitextE.tagRegex.void.test(nodeName)) {
					parsed.push(
						createVoidTagObject(nodeName, m[0], i, startTags.length, false)
					);
				} else if (startTags.length) {
					// If there's no start tags stored, skip this end tag

					let closedTagCnt = 0;

					// Check the collected start tags
					startTags.some((start) => { // The most recenly collected tag is at index 0 (because of unshift)

						// true when e.g. <span></span>, false when e.g. <span><div></span>
						const startTagMatched = start.name === nodeName;
						// Get the last index of this end tag ("</span>|") or that of the unclosed tag ("<div>|</span>")
						const endIndex = startTagMatched ? i + endTag.length : i;
						const startTagName = sanitizeNodeName(start.name); // Sanitize the tag name, "--" becomes "!--"

						parsed.push({
							name: startTagName, // Can be the name of an unclosed tag
							get text() {
								return this.start + (this.content || '') + (this.unclosed ? '' : this.end);
							},
							start: wikitext.slice(start.startIndex, start.endIndex),
							content: wikitext.slice(start.endIndex, endIndex - (startTagMatched ? endTag.length : 0)),
							end: !startTagMatched ? `</${startTagName}>` : wikitext.slice(endIndex - endTag.length, endIndex),
							startIndex: start.startIndex,
							endIndex,
							// closedTagCnt being more than 0 means we forcibly closed unclosed tags in the previous loops.
							// But we have yet to remove the proccessed start tags, so we need to subtract the number of
							// the processed tags to calculate the nesting level properly
							nestLevel: startTags.length - 1 - closedTagCnt,
							void: false,
							unclosed: !startTagMatched,
							selfClosing: start.selfClosing
						});
						closedTagCnt++;

						// Exit the loop when we find a start-end pair
						if (startTagMatched) {
							return true;
						}
					});

					// Remove the matched start tags from the stack
					startTags.splice(0, closedTagCnt);

				}

				i += m[0].length - 1;

			}
		}

		// Handle any unclosed tags left in the stack
		startTags.forEach(({name, startIndex, endIndex, selfClosing}, i, arr) => {
			const startTagName = sanitizeNodeName(name);
			parsed.push({
				name: startTagName,
				get text() {
					return this.start + (this.content || '') + (this.unclosed ? '' : this.end);
				},
				start: wikitext.slice(startIndex, endIndex),
				content: wikitext.slice(endIndex, wikitext.length),
				end: `</${startTagName}>`,
				startIndex,
				endIndex: wikitext.length,
				nestLevel: arr.length - 1 - i,
				void: false,
				unclosed: true,
				selfClosing
			});
		});

		// Sort the parsed tags based on their positions in the wikitext and return
		return parsed.sort((obj1, obj2) => {
			if (obj1.startIndex < obj2.startIndex) {
				return -1;
			} else if (obj2.endIndex < obj1.endIndex) {
				return 1;
			} else {
				return 0;
			}
		});

	}

	/**
	 * Parse the wikitext content for HTML tags.
	 * @param config Config to filter the output.
	 * @returns
	 */
	parseTags(config: ParseTagsConfig = {}): Tag[] {
		let tags = this.tags;
		if (typeof config.namePredicate === 'function') {
			tags = tags.filter(({name}) => config.namePredicate!(name));
		}
		if (typeof config.tagPredicate === 'function') {
			tags = tags.filter((obj) => config.tagPredicate!(obj));
		}
		return tags;
	}

	/**
	 * Modify tags in the wikitext content.
	 *
	 * For example:
	 * ```typescript
	 * // Close unclosed tags
	 * const wkt = new WikitextE('<span>a<div><del>b</span><span>c');
	 * const oldContent = wkt.content;
	 * const newContent = wkt.modifyTags(
	 * 	(tags) => {
	 * 		return tags.reduce((acc: (string | null)[], obj) => {
	 * 			if (obj.unclosed) { // An end tag is missing
	 * 				acc.push(obj.text + obj.end); // Register the new tag text
	 * 			} else {
	 * 				acc.push(null); // Register null for no change
	 * 			}
	 * 			return acc;
	 * 		}, []);
	 * 	}
	 * );
	 * if (oldContent !== newContent) {
	 * 	console.log(newContent);
	 * 	// Output: <span>a<div><del>b</del></div></span><span>c</span>
	 * }
	 * ```
	 *
	 * Note that {@link content} and {@link tags} will be updated based on the modification.
	 * After running this method, **do not re-use copies of them iniatialized before running this method**.
	 *
	 * @param modificationPredicate
	 * A predicate that specifies how the tags should be modified. This is a function that takes an array of
	 * tag objects and returns an array of strings or `null`. Each string element represents the new content
	 * for the corresponding tag, while `null` means no modification for that tag.
	 * @param outputTags
	 * Whether to return (a deep copy of) an array of modified tag objects.
	 * @returns
	 * The modified wikitext content as a string, or an array of tag objects, depending on whether `outputTags` is true.
	 * @throws
	 * If the length of the array returned by `modificationPredicate` does not match that of the "tags" array.
	 */
	modifyTags(modificationPredicate: TagModificationPredicate, outputTags?: false): string;
	modifyTags(modificationPredicate: TagModificationPredicate, outputTags: true): Tag[];
	modifyTags(modificationPredicate: TagModificationPredicate, outputTags = false): Tag[] | string {

		// Get text modification settings
		const tags = this.tags;
		const mods = modificationPredicate(tags);
		if (mods.length !== tags.length) {
			throw new Error('The length of the array returned by modificationPredicate does not match that of the "tags" array.');
		} else if (!Array.isArray(mods)) {
			throw new TypeError('modificationPredicate must return an array.');
		}

		// Apply the changes and update the entire wikitext content
		let newContent = this.content;
		mods.some((text, i, arr) => {
			if (typeof text === 'string') {

				// Replace the old tag content with a new one
				const initialEndIndex = this._tags[i].endIndex;
				const firstPart = newContent.slice(0, this._tags[i].startIndex);
				const secondPart = newContent.slice(initialEndIndex);
				newContent = firstPart + text + secondPart;

				// Exit early if this is the last loop iteration
				if (i === arr.length - 1) {
					return true;
				} // Otherwise we need to update the character indexes to continue the iteration

				// Adjust the end index of the modified tag based on new text length
				// (the start index doesn't change)
				const lengthGap = text.length - this._tags[i].text.length;
				this._tags[i].endIndex += lengthGap;

				// Adjust the start and end indices of all other tags
				this._tags.forEach((obj, j) => {
					if (i !== j) {
						if (obj.startIndex > initialEndIndex) {
							obj.startIndex += lengthGap;
							obj.endIndex += lengthGap;
						} else if (obj.endIndex > initialEndIndex) {
							obj.endIndex += lengthGap;
						}
					}
				});

			}
		});

		// Update the content and tags after the modifications
		this._content = newContent;
		this._tags = WikitextE.parseTags(newContent); // Re-parse to update tag properties (e.g. nestLevel)

		// Return the appropriate result based on the `outputTags` parameter
		if (outputTags) {
			return this.tags;
		} else {
			return this.content;
		}

	}

}

// Interfaces and private members for "parseTags"

/**
 * Object that holds information about an HTML tag, parsed from wikitext.
 */
export interface Tag {
	/**
	 * The name of the tag (e.g. "div" for `<div></div>`). Comment tags (i.e. `<!-- -->`) are named "!--".
	 */
	name: string;
	/**
	 * The outerHTML of the tag.
	 */
	readonly text: string;
	/**
	 * The start tag.
	 *
	 * NOTE: The end tag of a void tag is considered to be an end tag. Try `</br>` in WikiEditor.
	 */
	start: string;
	/**
	 * The innerHTML of the tag. May be `null` if this is a void tag.
	 */
	content: string | null;
	/**
	 * The end tag.
	 *
	 * Be aware of the following cases:
	 * * If this tag is a void tag, this property is an empty string.
	 * * If this tag is unclosed even though it should be closed, this property is the expected end tag.
	 */
	end: string;
	/**
	 * The index at which this tag starts in the wikitext.
	 */
	startIndex: number;
	/**
	 * The index at which this tag ends in the wikitext.
	 */
	endIndex: number;
	/**
	 * The nesting level of this tag. `0` if not nested within another tag.
	 */
	nestLevel: number;
	/**
	 * Whether this tag is a void tag.
	 */
	void: boolean;
	/**
	 * Whether this tag is properly closed.
	 */
	unclosed: boolean;
	/**
	 * Whether this tag is a self-closing tag (which is invalid in HTML).
	 */
	selfClosing: boolean;
}

/**
 * Object that holds the information of unclosed start tags that need matching end tags.
 */
interface StartTag {
	name: string;
	startIndex: number;
	endIndex: number;
	selfClosing: boolean;
}

/**
 * Sanitize the tag name `--` to `!--`, or else return the input as is.
 * @param name
 * @returns
 */
function sanitizeNodeName(name: string): string {
	return name === '--' ? '!' + name : name;
}

function createVoidTagObject(nodeName: string, startTag: string, startIndex: number, nestLevel: number, selfClosing: boolean): Tag {
	return {
		name: nodeName, // Not calling sanitizeNodeName because this is never a comment tag
		get text() { // The entire void tag (e.g. <br>)
			return this.start;
		},
		start: startTag,
		content: null, // Void tags have no content
		end: '',
		startIndex,
		endIndex: startIndex + startTag.length,
		nestLevel,
		void: true,
		unclosed: false,
		selfClosing
	};
}

/**
 * Parsing config for {@link WikitextE.parseTags}.
 */
export interface ParseTagsConfig {
	/**
	 * Only parse tags whose names match this predicate.
	 * @param name The name of the tag.
	 * @returns A boolean indicating whether the tag name matches the predicate.
	 */
	namePredicate?: (name: string) => boolean;
	/**
	 * Only parse tags that match this predicate.
	 * @param tag The tag object.
	 * @returns A boolean indicating whether the tag matches the predicate.
	 */
	tagPredicate?: (tag: Tag) => boolean;
}

/**
 * @see WikitextE.modifyTags
 */
export type TagModificationPredicate = (tags: Tag[]) => (string | null)[];