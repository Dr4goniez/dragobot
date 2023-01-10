"use strict";
/* ----------------------------------------------------------------------------------------------------
    This is an example of my.ts. Include your user credentials in this file.
    If you want to manage multiple accounts, create a new object in the form of UserInfo and export
    it as a property of the 'my' object. The keys of the object must be in the form of 'userinfo'
    + some additional identifier. Pass that indentifier to mw.init(ID) to use an account other than
    the main one.
------------------------------------------------------------------------------------------------------- */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bots = exports.my = void 0;
const userinfo = {
    apiUrl: 'https://ja.wikipedia.org/w/api.php',
    username: 'YourBotUsername',
    password: 'YourBotPassword'
};
const userinfo2 = {
    apiUrl: 'https://ja.wikipedia.org/w/api.php',
    username: 'YourBotUsername2',
    password: 'YourBotPassword2'
};
exports.my = {
    userinfo,
    userinfo2
};
// An array of users that have a bot flag. If logged in with one of these accounts, API requests are sent with high API limits.
exports.bots = [
    'YourBotUsername'
];
