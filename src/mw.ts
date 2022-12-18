import { my } from './my'
import { log } from './server';
import { DynamicObject } from '.';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MWBot = require('mwbot');

const mw = new MWBot();
// let cnt = 0;

/**
 * Initialize a mwbot instance. This function should be called AFTER the server gets ready.
 * @param identifier my['userinfo' + identifier]. Set to an empty string if not provided.
 * @return Initialized mwbot instance if successfully logged in, otherwise undefined
 */
export const init = async (identifier?: string | number) => {

    if (!['string', 'number'].includes(typeof identifier)) identifier = '';
    const userinfo: keyof typeof my = 'userinfo' + identifier;

    const loggedIn = await mw.loginGetEditToken(my[userinfo])
    .then((res: DynamicObject) => {
        return res && res.result === 'Success';
    }).catch((err: DynamicObject) => log(err.response.login.reason));

    // if (cnt === 0) mw.editToken = null;
    // cnt++
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