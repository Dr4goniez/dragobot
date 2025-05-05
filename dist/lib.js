"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeWebpage = scrapeWebpage;
exports.filterSet = filterSet;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
/**
 * Scrapes a webpage by URL.
 *
 * @param url
 * @returns A Promise resolving to a Cheerio object or `null`.
 *
 * *This function never rejects*.
 */
async function scrapeWebpage(url) {
    try {
        const res = await axios_1.default.get(url);
        const $ = cheerio.load(res.data);
        return $;
    }
    catch (err) {
        console.error(err);
        return null;
    }
}
/**
 * Creates a new Set containing only the elements that satisfy the provided predicate.
 *
 * This function behaves similarly to `Array.prototype.filter`, but for `Set` instances.
 *
 * @template T The type of elements in the input set.
 * @param set The input `Set` to filter.
 * @param predicate A function that is called for each element in the set.
 * If it returns `true`, the element is included in the result.
 * @returns A new `Set` containing only the elements for which the predicate returned `true`.
 */
function filterSet(set, predicate) {
    const result = new Set();
    for (const item of set) {
        if (predicate(item)) {
            result.add(item);
        }
    }
    return result;
}
