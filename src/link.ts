import { Title } from './title';
import { clean } from './lib';

export class Link {

	/**
	 * The target of the link.
	 */
	target: string;
	/**
	 * A `Title` class instance for `target`. Can be `null` in cases like `[[{{MAGICWORD}}]]`.
	 */
	Title: Title|null;
	/**
	 * The display of the link.
	 */
	display: string;
	/**
	 * Whether the link is external.
	 */
	readonly external: boolean;

	constructor(target: string, options?: {
		/**
		 * The display text of the link.
		 */
		display?: string;
		/**
		 * Whether this should be an external link.
		 */
		external?: boolean;
	}) {
		options = options || {};
		this.target = target;
		this.Title = Title.newFromText(target);
		this.display = options.display || '';
		this.external = typeof options.external === 'boolean' ? options.external : false;
	}

	/**
	 * Get the link target.
	 * @returns
	 */
	getTarget(): string {
		return this.target;
	}

	/**
	 * Set (and change) the link target.
	 * @returns
	 */
	setTarget(target: string): Link {
		this.target = target;
		this.Title = Title.newFromText(target);
		return this;
	}

	/**
	 * Get the display text of the link.
	 * @param absolute Whether to get the absolute value of `Link.display`.
	 * @returns
	 */
	getDisplay(absolute = true): string {
		return this.display;
	}

	/**
	 * Set (and change) the display text of the link.
	 * @returns
	 */
	setDisplay(display: string): Link {
		this.display = display;
		return this;
	}

	isExternal(): boolean {
		return this.external;
	}

	render(): string {
		const ret = [
			this.isExternal() ? '[' : '[[',
			this.getTarget(),
			this.getDisplay() ? '|' + this.getDisplay() : '',
			this.isExternal() ? ']' : ']]',
		];
		return ret.join('');
	}
}