"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Util = void 0;
exports.init = init;
exports.getMwbot = getMwbot;
const mwbot_ts_1 = require("mwbot-ts");
const creds_1 = require("./creds");
const version_1 = require("./version");
exports.Util = mwbot_ts_1.Mwbot.Util;
let mwbot;
/**
 * Initializes an Mwbot instance.
 *
 * @param user The user account to use.
 * @returns A Promise resolving to an Mwbot instance.
 */
async function init(user, apiUrl) {
    const initOptions = {
        apiUrl: apiUrl || 'https://ja.wikipedia.org/w/api.php',
        userAgent: `dragobot/${version_1.VERSION} (https://github.com/Dr4goniez/dragobot)`,
        ...creds_1.creds[user]
    };
    mwbot = await mwbot_ts_1.Mwbot.init(initOptions);
    return mwbot;
}
/**
 * Gets the initialized Mwbot instance.
 *
 * @returns The Mwbot instance.
 * @throws If {@link init} hasn't been called.
 */
function getMwbot() {
    if (!mwbot) {
        throw new Error('"mwbot" has not been initialized.');
    }
    return mwbot;
}
