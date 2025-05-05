"use strict";
/**
 * This module provides an entry point to the bot application.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mwbot_1 = require("./mwbot");
const markup_1 = require("./markup");
const pp_1 = require("./pp");
const rfb_1 = require("./rfb");
(0, mwbot_1.init)('dragobot').then(() => {
    let runCount = 0;
    let lastRunDate = null;
    // Define the process to repeat
    const bot = async () => {
        const date = new Date();
        const nextRun = date.getTime() + 10 * 60 * 1000;
        console.log(`Current time: ${date.toISOString()}`);
        // Check RFB-related pages if the month is transitioning
        // Note: This should be done before any time-consuming processes
        const checkRFB = isLastDayBetween1430And1440UTC(date);
        // Check global block/lock statuses every 6 runs (1 hour)
        const checkGlobal = runCount % 6 === 0;
        // Check local block statuses?
        const checkBlocks = checkGlobal || await newBlocksPresent(lastRunDate);
        lastRunDate = date;
        // Check inappropriate protection templates every 3 runs (30 minutes)
        const checkProtectionTemplates = runCount % 3 === 0;
        // ------------------------------ markup ------------------------------
        if (checkBlocks) {
            await (0, markup_1.markupANs)(checkGlobal);
        }
        else {
            console.log('Markup cancelled: No new blocks found.');
        }
        // ------------------------------ updateRFB ------------------------------
        if (checkRFB) {
            await (0, rfb_1.updateRFB)();
        }
        // ------------------------------ removePp ------------------------------
        if (checkProtectionTemplates) {
            await (0, pp_1.removePp)(nextRun);
        }
        runCount++;
    };
    bot();
    setInterval(bot, 10 * 60 * 1000); // Run the bot every 10 minutes
});
/**
 * Checks if the current time is the last day of the month between 14:30 and 14:40 UTC.
 */
function isLastDayBetween1430And1440UTC(now) {
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    // Get the last day of the current month
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const isLastDay = now.getUTCDate() === lastDay.getUTCDate();
    // Check if the current time is between 14:30 and 14:40 UTC
    const isWithinTimeRange = utcHours === 14 && utcMinutes >= 30 && utcMinutes < 40;
    return isLastDay && isWithinTimeRange;
}
/**
 * Checks whether new blocks (excluding automatic ones) have been applied since the last run.
 * Always returns true on the first run or if an error occurs.
 */
async function newBlocksPresent(lastRunDate) {
    if (lastRunDate === null) {
        // Always check on the first run
        return true;
    }
    return (0, mwbot_1.getMwbot)().get({
        list: 'blocks',
        bkstart: lastRunDate.toUTCString(),
        bkdir: 'newer',
        bklimit: 'max',
        bkprop: 'timestamp|flags'
    }).then((res) => {
        const resBlocks = res.query?.blocks;
        if (!resBlocks) {
            // Interpret empty responses as there've been new blocks applied
            return true;
        }
        const lastRunTime = lastRunDate.getTime();
        for (const { automatic, timestamp } of resBlocks) {
            if (!automatic && timestamp && Date.parse(timestamp) >= lastRunTime) {
                return true;
            }
        }
        return false;
    }).catch((err) => {
        console.dir(err, { depth: 3 });
        return true;
    });
}
