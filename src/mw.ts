import { my, bots } from './my'
import { log } from './server';
import { DynamicObject } from '.';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MWBot = require('mwbot');

let mw = new MWBot(); // Temporary substituion to prevent type mismatches
let ID: string | number; // Ensure that init() is run for the same account when called after the initial call

/**
 * Initialize a mwbot instance. This function should be called AFTER the server gets ready.
 * @param identifier my['userinfo' + identifier]. Set to an empty string if not provided.
 * @return Initialized mwbot instance if successfully logged in, otherwise undefined
 */
export const init = async (identifier?: string | number) => {

    if (typeof identifier === 'undefined') identifier = '';
    if (!ID) ID = identifier;
    const userinfo: keyof typeof my = 'userinfo' + ID;

    mw = new MWBot(); // Edit fails if the mwbot instance isn't updated everytime when it's initialized
    const loggedIn = await mw.loginGetEditToken(my[userinfo])
    .then((res: DynamicObject) => {
        return res && res.result === 'Success';
    }).catch((err: DynamicObject) => log(err.response.login.reason));

    if (loggedIn) {
        const host = my[userinfo].apiUrl.replace(/^(https?:)?\/\//, '').split('/')[0];
        log(`Logged in as ${my[userinfo].username}@${host}`);
        return mw;
    } else {
        log('Failed to log in.');
        return;
    }

};

/** Get the initialized mw instance. */
export const getMw = () => mw;

/** Check whether the current user is a bot. Accounts need to be added to my.ts. */
export const isBot = () => { // Must be a function because mw.state is available only when the Promise of init has been settled
    if (!mw.state.lgusername) return null;
    return bots.includes(mw.state.lgusername);
};