"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Link = void 0;
const title_1 = require("./title");
class Link {
    constructor(target, options) {
        options = options || {};
        this.target = target;
        this.Title = title_1.Title.newFromText(target);
        this.display = options.display || '';
        this.external = typeof options.external === 'boolean' ? options.external : false;
    }
    /**
     * Get the link target.
     * @returns
     */
    getTarget() {
        return this.target;
    }
    /**
     * Set (and change) the link target.
     * @returns
     */
    setTarget(target) {
        this.target = target;
        this.Title = title_1.Title.newFromText(target);
        return this;
    }
    /**
     * Get the display text of the link.
     * @param absolute Whether to get the absolute value of `Link.display`.
     * @returns
     */
    getDisplay(absolute = true) {
        return this.display;
    }
    /**
     * Set (and change) the display text of the link.
     * @returns
     */
    setDisplay(display) {
        this.display = display;
        return this;
    }
    isExternal() {
        return this.external;
    }
    render() {
        const ret = [
            this.isExternal() ? '[' : '[[',
            this.getTarget(),
            this.getDisplay() ? '|' + this.getDisplay() : '',
            this.isExternal() ? ']' : ']]',
        ];
        return ret.join('');
    }
}
exports.Link = Link;
