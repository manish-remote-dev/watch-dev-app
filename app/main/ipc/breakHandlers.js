const { ipcMain } = require('electron/main');
const { getAllBreaks, getCurrentRunningBreak, startAutoSyncCurrentBreak, stopAutoSyncCurrentBreak, closeReminderBreakModal } = require('../js/break');
const { getUserInfo, asyncApiRequest } = require('../js/lib');
const { executeQuery } = require('../sqlitedb/sqlitedb');
const { captureScreenShot, stopScreenShotInterval } = require('../js/screenshot');
const { BASE_URL, API_ENDPOINT } = require("../config");

function breakTrackingHandlers(mainWindow) {    
    ipcMain.handle("get-breaks", async(event, options = {}) => {
        try {
            const getBreaks = await getAllBreaks(options);
            return getBreaks.breaks;
        } catch (error) {
            console.error("Error in get-breaks handler:", error);
            throw new Error("Internal error fetching breaks.");
        }
    });
    
    ipcMain.handle("start-break", (event, breakId) => {
        return new Promise(async (resolve, reject) => {
            try {
                //console.log("====START Break=====", breakId);
                const userInfo = await getUserInfo();
                const userId = userInfo.user.user_id;
                const fullName = `${userInfo.user.first_name} ${userInfo.user.last_name}`;
                const getBreaks = await getAllBreaks({ breakId });
                //console.log("getBreaks", getBreaks);
                const currentDateTimeInGMT = new Date().toISOString();
                const breakTrackingQuery = `
                    INSERT INTO break_log (break_id, user_id, user_name, start_at, end_at, system_auto_sync_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                `;
                const breakTrackingParams = [breakId, userId, fullName, currentDateTimeInGMT, null, currentDateTimeInGMT, currentDateTimeInGMT, currentDateTimeInGMT];
                const breakTrackingResponse = await executeQuery(breakTrackingQuery, breakTrackingParams);
                
    
                if (!breakTrackingResponse.lastId || breakTrackingResponse.lastId <= 0) {
                    throw new Error("Failed to start break tracking.");
                }
    
                if (getBreaks.track_on_break) {
                    await captureScreenShot();
                }
                await startAutoSyncCurrentBreak(breakTrackingResponse.lastId, getBreaks.durations, mainWindow);
                resolve({ success: true });
            } catch (error) {
                console.error("Error in start-break handler:", error);
                reject(new Error("Failed to start break."));
            }
        });
    });
    
    ipcMain.handle("stop-break", (event, breakId) => {
        return new Promise(async (resolve, reject) => {
            try {
                //console.log("====STOP Break=====", breakId);
                const currentRunningBreak = await getCurrentRunningBreak();
                //console.log("currentRunningBreak", currentRunningBreak);
                
                if (!currentRunningBreak) {
                    return reject(new Error("No active break found to stop."));
                }
    
                const currentDateTimeInGMT = new Date().toISOString();
                const updateBreakQuery = "UPDATE break_log SET end_at = ? WHERE (end_at IS NULL OR end_at = '') AND id = ?";
                const updateBreakParam = [currentDateTimeInGMT, currentRunningBreak.id];
                const updateBreakResponse = await executeQuery(updateBreakQuery, updateBreakParam);
    
                if (updateBreakResponse.changes === 1) {
                    const getBreaks = await getAllBreaks({ breakId });
                    if (getBreaks.track_on_break) {
                        await stopScreenShotInterval();
                    }
                    await stopAutoSyncCurrentBreak(currentRunningBreak.id);
                    resolve({ success: true });
                } else {
                    resolve({ success: false });
                }
            } catch (error) {
                console.error("Error in stop-break handler:", error);
                reject(error);
            }
        });
    });
    
    ipcMain.handle("current-running-break", async (event) => {
        try {
            const currentRunningBreak = await getCurrentRunningBreak();
            return currentRunningBreak ? currentRunningBreak : null;
        } catch (error) {
            console.error("Error fetching current running break:", error);
            throw new Error("Failed to fetch current running break.");
        }
    });
    
    ipcMain.on('close-reminder-break-modal', async () => {
        //console.log("UNDER close-reminder-break-modal HANDLER");
        closeReminderBreakModal();
    });
}

module.exports = {
    breakTrackingHandlers
};

ipcMain.handle("get-todays-total-break-time", (event, userId) => {
    return new Promise( async (resolve, reject) => {
        try {
            const breakTimeUrl = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.BREAK_TIME
            const requestInfo = {
                method: "GET",
                url: breakTimeUrl,
                authType: 'bearertoken',
                queryParams: {
                    'userIds': userId
                }
            };
            const response = await asyncApiRequest(requestInfo);
            resolve(response);
        } catch (error) {
            reject(error);
        }
    });
});