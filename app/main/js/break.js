const { app, BrowserWindow, powerMonitor } = require('electron');
const path = require('path');
const { BASE_URL, API_ENDPOINT, AUTO_SYNC_TIME, BREAK_REMINDER_COUNTER, MAX_IDLE_TIME, NON_IDLE_THRESHOLD, REPEAT_REMINDER } = require('../config');
const { executeQuery, getRow, getRows } = require('../sqlitedb/sqlitedb');
const { asyncApiRequest, intervalManager, getUserInfo } = require('./lib');

let baseWindow;
let reminderBreakWindow = null;
let reminderBreakCounter = 0;
let isBreakStopped = false;
let breakLastId = 0;

//let reminderTimeout = null;
let activityCount = 0; // Tracks the number of non-idle moments

const getAllBreaks = async (getBreaksByOptions = {}) => {
    try {
        const { breakId, userId } = getBreaksByOptions;
        const requestInfo = {
            method: "GET",
            url: BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.BREAK_SETTINGS,
            authType: "bearertoken",
            queryParams: {}
        }
        if (breakId) requestInfo.queryParams.breakId = breakId;
        if (userId) requestInfo.queryParams.userId = userId;
        const response = await asyncApiRequest(requestInfo);
        if (response.data.data) {
            return response.data.data;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
};

const getCurrentRunningBreak = async () => {
    try {
        const userInfo = await getUserInfo();
        const userId = userInfo.user.user_id;

        const selectQuery = "SELECT id, break_id, start_at, system_auto_sync_at FROM break_log WHERE end_at IS NULL AND user_id = ? ORDER BY rowid DESC LIMIT 1";
        const currentRunningBreak = await getRow(selectQuery, [userId]);
        
        if (!currentRunningBreak) {
            return null;
        }
        return currentRunningBreak;
    } catch (error) {
        throw error;
    }
};

const startAutoSyncCurrentBreak = async (breakLastInsertId, idealBreakDurations, mainWindow) => {
    baseWindow = mainWindow;

    breakLastId = breakLastInsertId;
    isBreakStopped = false;

	intervalManager.startInterval(breakLastId + '-breakStart', async () => await breakAutoSync(breakLastId), AUTO_SYNC_TIME);
    if (idealBreakDurations > 0) {
        activityCount = 0;
        setTimeout(() => {
            if (isBreakStopped) {
                return;
            }
            startReminderBreakMonitoring();
        }, parseInt(idealBreakDurations) * 60 * 1000);
    }
    
}

async function breakAutoSync(breakLastInsertId) {
  try {
    const query = `UPDATE break_log SET system_auto_sync_at = ? WHERE id = ?`;
    const currentDateTimeInGMT = new Date().toISOString();
    const params = [currentDateTimeInGMT, breakLastId];
    await executeQuery(query, params);
  } catch (error) {
    throw error;
  }
}

async function startReminderBreakMonitoring() {
    const intervalId = `${breakLastId}-reminderBreakStart`;
    intervalManager.startInterval(intervalId, async () => {
        await reminderBreak();
    }, 1000); //If here not do this, then after break time, it will wait for repeating time once for the first time
}

async function repeatReminderBreak() {
    if (reminderBreakCounter < BREAK_REMINDER_COUNTER) {
        if(reminderBreakCounter > 0) {
            if (!reminderBreakWindow || reminderBreakWindow.isDestroyed()) {
                intervalManager.startInterval(breakLastId + '-reminderBreakStart', async () => await reminderBreak(), 1000);
            }
        }
    } else {
        intervalManager.stopInterval(breakLastId + '-repeatReminderBreakStart');
        intervalManager.stopInterval(breakLastId + '-reminderBreakStart');
    }
}

async function reminderBreak() {
    try {
        let idleTime = powerMonitor.getSystemIdleTime();
        if (idleTime === 0) {
            activityCount++;
        }

        if (activityCount >= NON_IDLE_THRESHOLD) {
            activityCount = 0;            
            await intervalManager.stopInterval(breakLastId + '-reminderBreakStart');
            await reminderBreakModal();
        }
    } catch (error) {
        console.error('Error in reminderBreak:', error);
    }
}

async function reminderBreakModal() {
    try {
        if (baseWindow) {
            baseWindow.show();
        }

        if (reminderBreakWindow) {
            return;
        }

        reminderBreakWindow = new BrowserWindow({
            width: 500,
            height: 400,
            frame: false,
            alwaysOnTop: true,
            modal: true,
            parent: baseWindow,
            webPreferences: {
                preload: path.join(app.getAppPath(), 'app/main/preload.js'),
                sandbox: false,
            }
        });

        reminderBreakWindow.loadFile(path.join(app.getAppPath(), 'app/renderer/pages/reminderBreakModal.html'));

        reminderBreakCounter++; //If modal show, count increased by one.

        setTimeout(() => {
            if (reminderBreakWindow && !reminderBreakWindow.isDestroyed()) {
                reminderBreakWindow.close();
                reminderBreakWindow = null;
            }
        }, MAX_IDLE_TIME);

    } catch (error) {
        console.error('Error in reminderBreakModal:', error);
        throw new Error("Internal Error");
    }
}

async function closeReminderBreakModal() {
    if (reminderBreakWindow && !reminderBreakWindow.isDestroyed()) {
        reminderBreakWindow.close();
        reminderBreakWindow = null;
    }
    if (reminderBreakCounter < BREAK_REMINDER_COUNTER) {
        intervalManager.startInterval(breakLastId + '-repeatReminderBreakStart', async () => await repeatReminderBreak(), REPEAT_REMINDER);
    }
}

const stopAutoSyncCurrentBreak = (currentRunningBreakId) => {
    intervalManager.stopInterval(breakLastId + '-breakStart');
    activityCount = 0;
    reminderBreakCounter = 0
    isBreakStopped = true;
    if (reminderBreakWindow && !reminderBreakWindow.isDestroyed()) {
        reminderBreakWindow.close();
        reminderBreakWindow = null;
    }
    intervalManager.stopInterval(breakLastId + '-repeatReminderBreakStart');
    intervalManager.stopInterval(breakLastId + '-reminderBreakStart');
    
}

async function checkAndUpdateCurrentRunningBreak() {
    try {
        const currentRunningBreak = await getCurrentRunningBreak();
        if (!currentRunningBreak) {
            return;
        }
        const breakId = currentRunningBreak.id;
        const currentRunningBreakLastSystemSyncTime = currentRunningBreak.system_auto_sync_at;
        const updateBreakQuery = "UPDATE break_log SET end_at = ? WHERE (end_at IS NULL OR end_at = '') AND id = ?";
        const updateBreakParam = [currentRunningBreakLastSystemSyncTime, breakId];
        const updateTimeSegmentResponse = await executeQuery(updateBreakQuery, updateBreakParam);
        if( updateTimeSegmentResponse.lastId ) {
            return true;
        }
    } catch (error) {
        throw error;
    }
}

async function syncBreakTrackingToMongoDB(userId) {
    try {
        const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_BREAK_TRACKING;
        let recordToUpdate = {};
        const selectBreakQuery = "SELECT * FROM break_log WHERE user_id = ?";
        const selectBreakParam = [userId];
        const selectBreakResponses = await getRows(selectBreakQuery, selectBreakParam);
        if(!selectBreakResponses) {
            return null
        }

        if (selectBreakResponses.length > 0) {
            for (const selectBreakResponse of selectBreakResponses) {
                recordToUpdate = {
                    "id": selectBreakResponse.id,
                    "break_id": selectBreakResponse.break_id,
                    "user_id": selectBreakResponse.user_id,
                    "user_name": selectBreakResponse.user_name,
                    "system_auto_sync_at": selectBreakResponse.system_auto_sync_at,
                    "start_at":  selectBreakResponse.start_at,
                    "end_at": selectBreakResponse.end_at,
                    "inserted_at": selectBreakResponse.created_at
                }
        
                if (Object.keys(recordToUpdate).length > 0) {
                    const payload = recordToUpdate;
                    const requestInfo = {
                        method: "POST",
                        url: url,
                        authType: 'bearertoken',
                        requestData: payload
                    }
                    const result = await asyncApiRequest(requestInfo);
                    if (result.data.data) {
                        const res = result.data.data;
                        if (res.successID) {
                            
                            if(selectBreakResponse.end_at != null) {
                                deleteLocalBreakLog(res.successID);
                            }
                        }
                    }
                }
            }
        } else {
            return false;
        }
    } catch(e) {
        console.error(`Error syncing task tracking to MongoDB:`, e);
    }
}

async function deleteLocalBreakLog(successID) {
    try {
        const deleteBreakLogQuery = "DELETE FROM break_log WHERE id =?";
        const deleteBreakLogParam = [successID];
        await executeQuery(deleteBreakLogQuery, deleteBreakLogParam);
    } catch (err) {
        console.error(`Error deleting from break_log:`, err);
        throw error;
    }
}

module.exports = {
    getAllBreaks,
    getCurrentRunningBreak,
    startAutoSyncCurrentBreak,
    stopAutoSyncCurrentBreak,
    checkAndUpdateCurrentRunningBreak,
    syncBreakTrackingToMongoDB,
    closeReminderBreakModal
};