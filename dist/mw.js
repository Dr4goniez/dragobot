"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBot = exports.getMw = exports.init = void 0;
const my_1 = require("./my");
const server_1 = require("./server");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MWBot = require('mwbot');
let mw = new MWBot(); // Temporary substituion to prevent type mismatches
let ID; // Ensure that init() is run for the same account when called after the initial call
/**
 * Initialize a mwbot instance. This function should be called AFTER the server gets ready.
 * @param identifier my['userinfo' + identifier]. Set to an empty string if not provided.
 * @return Initialized mwbot instance if successfully logged in, otherwise undefined
 */
const init = async (identifier) => {
    if (typeof identifier === 'undefined')
        identifier = '';
    if (!ID)
        ID = identifier;
    const userinfo = 'userinfo' + ID;
    mw = new MWBot(); // Edit fails if the mwbot instance isn't updated everytime when it's initialized
    const loggedIn = await mw.loginGetEditToken(my_1.my[userinfo])
        .then((res) => {
        return res && res.result === 'Success';
    }).catch((err) => (0, server_1.log)(err.response.login.reason));
    if (loggedIn) {
        const host = my_1.my[userinfo].apiUrl.replace(/^(https?:)?\/\//, '').split('/')[0];
        (0, server_1.log)(`Logged in as ${my_1.my[userinfo].username}@${host}`);
        return mw;
    }
    else {
        (0, server_1.log)('Failed to log in.');
        return;
    }
};
exports.init = init;
/** Get the initialized mw instance. */
const getMw = () => mw;
exports.getMw = getMw;
/** Check whether the current user is a bot. Accounts need to be added to my.ts. */
const isBot = () => {
    if (!mw.state.lgusername)
        return null;
    return my_1.bots.includes(mw.state.lgusername);
};
exports.isBot = isBot;
