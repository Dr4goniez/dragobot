/* ----------------------------------------------------------------------------------------------------
    This is an example of my.ts. Include your user credentials in this file.
    If you want to manage multiple accounts, create a new object in the form of UserInfo and export 
    it as a property of the 'my' object. The keys of the object must be in the form of 'userinfo'
    + some additional identifier. Pass that indentifier to mw.init(ID) to use an account other than
    the main one.
------------------------------------------------------------------------------------------------------- */

interface UserInfo {
    apiUrl: string,
    username: string,
    password: string
}
interface My {
    [key: string]: UserInfo
}

const userinfo: UserInfo = {
    apiUrl: 'https://ja.wikipedia.org/w/api.php',
    username: 'YourBotUsername',
    password: 'YourBotPassword'
};
const userinfo2: UserInfo = {
    apiUrl: 'https://ja.wikipedia.org/w/api.php',
    username: 'YourBotUsername2',
    password: 'YourBotPassword2'
};

export const my: My = {
    userinfo,
    userinfo2
};

// An array of users that have a bot flag. If logged in with one of these accounts, API requests are sent with high API limits.
export const bots: string[] = [
    'YourBotUsername'
];