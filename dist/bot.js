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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib = __importStar(require("./lib"));
const server_1 = require("./server");
const markup_1 = require("./markup");
const updateRFB_1 = require("./updateRFB");
const removePp_1 = require("./removePp");
const mw_1 = require("./mw");
(0, server_1.createServer)();
(0, mw_1.init)().then((mw) => {
    if (!mw)
        return;
    // The procedure to loop
    let runCnt = 0;
    let lastRunTs, checkBlocks, checkGlobal, checkRFB, checkProtectionTemplates;
    const bot = async () => {
        (0, server_1.log)('Current time: ' + lib.getCurTimestamp());
        checkBlocks = true;
        checkGlobal = false;
        checkRFB = monthTransitioning();
        checkProtectionTemplates = false;
        runCnt++;
        if (runCnt % 6 === 0) { // Check global block/lock status every 6 runs (1 hour)
            checkGlobal = true;
        }
        if (runCnt % 3 === 0) { // Check inappropriate protection templates every 3 runs (30 minutes)
            checkProtectionTemplates = true;
        }
        if (lastRunTs && checkGlobal !== true) { // checkBlocks should be always true if it's the first run and if checkGlobal === true
            checkBlocks = await checkNewBlocks(lastRunTs); // Check if anyone has been manually blocked since the last run, and if not, checkBlocks = false
        }
        lastRunTs = lib.getCurTimestamp();
        // ------------------------------ markup ------------------------------
        if (checkBlocks) {
            await (0, markup_1.markupANs)(checkGlobal);
        }
        else {
            (0, server_1.log)('Markup cancelled: No new blocks found.');
        }
        // ------------------------------ updateRFB ------------------------------
        if (checkRFB)
            await (0, updateRFB_1.updateRFB)();
        // ------------------------------ removePp ------------------------------
        if (checkProtectionTemplates)
            await (0, removePp_1.removePp)(lastRunTs);
    };
    bot();
    setInterval(bot, 10 * 60 * 1000);
});
/**
 * Check whether the current month is transitioning to the next.
 * @return True if the current time is between 23:30 and 23:40 on the last day of the month (JST)
 */
function monthTransitioning() {
    const d = new Date();
    d.setHours(d.getHours() + 9); // JST
    const year = d.getFullYear(), month = d.getMonth() + 1, lastDay = lib.lastDay(year, month), anchorTs40 = `${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:40:00Z`, anchorTs30 = anchorTs40.replace(/40:00Z$/, '30:00Z');
    return new Date(anchorTs40) >= d && d > new Date(anchorTs30);
}
/** Check whether anyone has been manually blocked since the last run. */
function checkNewBlocks(lastRunTs) {
    const mw = (0, mw_1.getMw)();
    return new Promise(resolve => {
        mw.request({
            action: 'query',
            list: 'blocks',
            bklimit: '50',
            bkprop: 'timestamp|flags',
            formatversion: '2'
        }).then((res) => {
            let resBlck;
            if (!res || !res.query || !(resBlck = res.query.blocks))
                return resolve(undefined);
            if (resBlck.length === 0)
                return resolve(undefined);
            resBlck = resBlck.filter(obj => !obj.automatic);
            if (resBlck.some(obj => lib.compareTimestamps(lastRunTs, obj.timestamp) >= 0)) {
                resolve(true); // Returns true if someone has been manually blocked since the last run
            }
            else {
                resolve(false);
            }
        }).catch((err) => {
            (0, server_1.log)(err);
            resolve(undefined);
        });
    });
}
