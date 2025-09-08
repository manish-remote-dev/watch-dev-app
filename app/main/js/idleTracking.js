const { app, BrowserWindow, powerMonitor } = require('electron');
const path = require('path');
const { getUserSettings, getUserInfo, intervalManager, getCurrentRunningTaskTrackingId, insertUserIdleTimeData } = require('./lib');
const { USER_SETTINGS_CONSTANTS, ERROR_MEG } = require('../config');
const { executeQuery } = require('../sqlitedb/sqlitedb');
const { startTaskWorkTimeLog, stopTaskWorkTimeLog } = require('./taskWorkTimeLog');

let mainWindow;
let confirmIdleWindow;
let modalWindow;
let currentlyIdle = false;
let idleTime = 0;

const idleTrackingStart = async (parentWindow) => {
    try {
        mainWindow = parentWindow;
        const userSettings = await getUserSettings();

        if (userSettings && userSettings[0] && userSettings[0][USER_SETTINGS_CONSTANTS.timeout] !== undefined) {
            const timeoutInterval = userSettings[0][USER_SETTINGS_CONSTANTS.timeout];
            if (timeoutInterval > 0) {
                const userInfo = await getUserInfo();
                intervalManager.startInterval(
                    `${userInfo.user.user_id}-timeout`,
                    () => startMonitoringInactivity(timeoutInterval),
                    1000
                );
            }
        }
    } catch (e) {
        console.error('Error starting idle tracking:', e);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
};

const startMonitoringInactivity = async(timeoutInterval) => {
    try {
        if (!currentlyIdle) { //If currentlyIdle false
            idleTime = powerMonitor.getSystemIdleTime();
            //console.log('idle time : ', idleTime);
            if (idleTime >= timeoutInterval) {
                currentlyIdle = true;
                await confirmActivityModal();
                //mainWindow.webContents.send('user-idle-channel', { openConfirmActivityModal: true });
            }
        }
    } catch (e) {
        console.error('Error starting monitoring inactivity:', e);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    } 
}

async function confirmActivityModal () {
    try {
        if (mainWindow) {
            mainWindow.show();
        }
        if (confirmIdleWindow) {
            return;
        }
        confirmIdleWindow = new BrowserWindow({
            width: 500,
            height: 400,
            frame: false,
            alwaysOnTop: true,
            modal: true,
            parent: mainWindow,
            webPreferences: {
                preload: path.join(app.getAppPath(), 'app/main/preload.js'),
                sandbox: false,
            }
        });
        //confirmIdleWindow.webContents.openDevTools();
        confirmIdleWindow.loadFile(path.join(app.getAppPath(), 'app/renderer/pages/confirmActivityWindow.html'));

        // mainWindow.webContents.send('user-idle-channel', { openConfirmActivityModal: true });
    } catch (e) {
        console.error('Error confirmActivityModal:', e);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
}

async function showIdleModal() {

    try {
        if (mainWindow) {
            mainWindow.show();
        }
        const currentTimestamp = new Date();
        const idleStartTime = new Date(currentTimestamp - idleTime * 1000);
        if (modalWindow) {
            return;
        }
        modalWindow = new BrowserWindow({
            width: 400,
            height: 300,
            frame: false,
            alwaysOnTop: true,
            modal: true,
            parent: mainWindow,
            webPreferences: {
                preload: path.join(app.getAppPath(), 'app/main/preload.js'),
                sandbox: false,
            }
        });
        //modalWindow.webContents.openDevTools();
        modalWindow.loadFile(path.join(app.getAppPath(), 'app/renderer/pages/idleModal.html'));
        
        modalWindow.webContents.once('did-finish-load', () => {
            modalWindow.webContents.send('user-idle-channel', { idleStartTime: idleStartTime.toISOString() });
        });
            
        await insertIdleTask(idleStartTime, 'idle');
        await insertUserIdleTimeData(idleStartTime, 'idle');
        
        await stopTaskWorkTimeLog(idleStartTime.toISOString());
        await startTaskWorkTimeLog();
    } catch (e) {
        console.error('Error showIdleModal:', e);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }     
}

function closeModalWindow() {
    if (modalWindow) {
        modalWindow.close();
        modalWindow = null;
        currentlyIdle = false;
    }
}

async function closeConfirmActivityModal(idleConfirmation) {
    if (confirmIdleWindow) {
        await confirmIdleWindow.close();
        confirmIdleWindow = null;
        if (idleConfirmation) {
            await showIdleModal();
        }
    }
    currentlyIdle = idleConfirmation;
}

const idleTrackingStop = async () => {
    const userInfo = await getUserInfo();
    await intervalManager.stopInterval(`${userInfo.user.user_id}-timeout`);
};

async function insertIdleTask(idleStartTime, mode) {
    try {
        const formattedIdleStartTime = idleStartTime.toISOString();

        const currentRunningTaskTrackingId = parseInt(await getCurrentRunningTaskTrackingId());

        if (!currentRunningTaskTrackingId) {
            return;
        }

        const updateSqlQuery = `
        UPDATE task_time_segment 
        SET end_at = ? 
        WHERE rowid = (
            SELECT rowid 
            FROM task_time_segment 
            WHERE end_at IS NULL AND task_tracking_id = ? 
            ORDER BY rowid DESC 
            LIMIT 1
        )`;
        const updateSqlParams = [formattedIdleStartTime, currentRunningTaskTrackingId];

        await executeQuery(updateSqlQuery, updateSqlParams);

        const timeSegmentQuery = `INSERT INTO task_time_segment (task_tracking_id, start_at, end_at, mode) VALUES (?, ?, ?, ?);`;
        const timeSegmentParams = [currentRunningTaskTrackingId, formattedIdleStartTime, null, mode];
        const timeSegmentResponse = await executeQuery(timeSegmentQuery, timeSegmentParams);
        if (timeSegmentResponse.lastId && timeSegmentResponse.lastId > 0) {
            return true;
        }
    } catch (e) {
        console.error('Error inserting idle task:', e);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
}

module.exports = {
    idleTrackingStart,
    closeModalWindow,
    closeConfirmActivityModal,
    idleTrackingStop,
    insertIdleTask
};