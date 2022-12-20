// Add methods to built-in JavaScript objects
'use strict';
String.prototype.trim2 = function () {
    return this.replace(/\u200e/g, '').trim();
};
String.prototype.split2 = function (delimiter, bottomup) {
    const chunks = this.split(delimiter);
    if (bottomup) {
        return [chunks.pop(), chunks.join(delimiter)].reverse();
    }
    else {
        return [chunks.shift(), chunks.join(delimiter)];
    }
};
Array.prototype.undup = function () {
    return this.filter((el, i, arr) => arr.indexOf(el) === i);
};
Object.prototype.replicate = function () {
    return JSON.parse(JSON.stringify(this));
};
