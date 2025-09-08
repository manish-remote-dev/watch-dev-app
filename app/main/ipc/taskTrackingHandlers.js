const { ipcMain } = require("electron");
const { executeQuery } = require('./../sqlitedb/sqlitedb');
const { getUserInfo, startAutoSyncCurrentTask, getCurrentRunningTasks, getUnfinishedTaskTrackingDetails, getTaskTrackedTime, stopAutoSyncCurrentTask, getUserSettings } = require('./../js/lib');
const { USER_SETTINGS_CONSTANTS, ERROR_MEG } = require('../config');
const { idleTrackingStart, idleTrackingStop } = require("../js/idleTracking");
const { noTrackingReminderStop, noTrackingReminderStart } = require("../js/noTrackingReminder");
const { autoSyncUserIdleTime } = require("../js/userIdleTimeTracking");
const { startTaskWorkTimeLog, stopTaskWorkTimeLog } = require("../js/taskWorkTimeLog");
const { captureScreenShot, stopScreenShotInterval } = require("../js/screenshot");
const { startWebAndUrlTracking, stopWebAndUrlTracking } = require("../js/webAndUrlTracking");
const { getCurrentRunningBreak } = require("../js/break");

function taskTrackingHandlers(mainWindow) {
    ipcMain.handle("current-running-task", (event) => {
        return new Promise( async (resolve, reject) => {
            try {
                const currentRunningTask = await getCurrentRunningTasks();
                if(currentRunningTask == null) {
                    resolve(null);
                }
                resolve(currentRunningTask);
            } catch (error) {
                reject(error);
            }
        });
    });

    ipcMain.handle("unfinished-task-tracking-details", (event, taskId) => {
        return new Promise( async (resolve, reject) => {
            try {
                const taskTrackingDetails = await getUnfinishedTaskTrackingDetails(taskId);
                resolve(taskTrackingDetails);
            } catch (error) {
                reject(error);
            }
        });
    });

    ipcMain.handle("get-task-tracked-time", (event, trackingId) => {
        return new Promise( async (resolve, reject) => {
            try {
                const trackedTime = await getTaskTrackedTime(trackingId);
                resolve(trackedTime);
            } catch (error) {
                reject(error);
            }
        });
    });
    
    ipcMain.handle("start-task", (event, taskId, taskTitle, projectId, projectName, mode, team_id, team_name) => {
        return new Promise(async (resolve, reject) => {
            try {
                const userInfo = await getUserInfo();
                const userId = userInfo.user.user_id;
                const fullName = `${userInfo.user.first_name} ${userInfo.user.last_name}`;
                /*const currentRunningBreak = await getCurrentRunningBreak();
                if (currentRunningBreak) {
                    console.log("Stopping current running break before starting task:", currentRunningBreak.break_id);
                    await stopBreak(currentRunningBreak.break_id);
                }*/


                // Insert task tracking
                const currentDateTimeInGMT = new Date().toISOString();
                const taskTrackingQuery = `
                    INSERT INTO task_tracking (task_id, task_title, project_id, project_name, user_id, user_name, system_auto_sync_at, created_at, updated_at, team_id, team_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                `;
                const taskTrackingParams = [taskId, taskTitle, projectId, projectName, userId, fullName, currentDateTimeInGMT, currentDateTimeInGMT, currentDateTimeInGMT, team_id, team_name];
                const taskTrackingResponse = await executeQuery(taskTrackingQuery, taskTrackingParams);

                if (!taskTrackingResponse.lastId || taskTrackingResponse.lastId <= 0) {
                    throw new Error(ERROR_MEG.TASK_START_ERROR);
                }

                // Insert time segment
                const timeSegmentQuery = `
                    INSERT INTO task_time_segment (task_tracking_id, start_at, end_at, mode)
                    VALUES (?, ?, ?, ?);
                `;
                const timeSegmentParams = [taskTrackingResponse.lastId, currentDateTimeInGMT, null, mode];
                const timeSegmentResponse = await executeQuery(timeSegmentQuery, timeSegmentParams);

                if (!timeSegmentResponse.lastId || timeSegmentResponse.lastId <= 0) {
                    throw new Error(ERROR_MEG.TASK_START_ERROR);
                }
                await captureScreenShot();
                await startAutoSyncCurrentTask(taskTrackingResponse.lastId);
                await autoSyncUserIdleTime(taskId, userId);
                await idleTrackingStart(mainWindow);
                await noTrackingReminderStop(mainWindow);
                await startTaskWorkTimeLog();
                const userSettings = await getUserSettings();
                const isWebAndAppTracking = userSettings[0][USER_SETTINGS_CONSTANTS.web_and_app_tracking];
                if ( isWebAndAppTracking == 1 ) {
                    await startWebAndUrlTracking(userId, taskId);
                }
                resolve(taskTrackingResponse);
            } catch (error) {
                reject(new Error(error || ERROR_MEG.TASK_START_ERROR));
            }
        });
    });

    ipcMain.handle("stop-task", (event, trackingId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const currentDateTimeInGMT = new Date().toISOString();
                const updateTimeSegmentQuery = "UPDATE task_time_segment SET end_at = ? WHERE (end_at IS NULL OR end_at = '') AND task_tracking_id = ?";
                const updateTimeSegmentParam = [currentDateTimeInGMT, trackingId];
                const updateTimeSegmentResponse = await executeQuery(updateTimeSegmentQuery, updateTimeSegmentParam);
                if (updateTimeSegmentResponse.changes == 1) {
                    const updateTaskTrackingQuery  = " UPDATE task_tracking SET is_finished = 1 WHERE id = ?";
                    const updateTaskTrackingQueryParams = [trackingId];
                    const updateTaskTrackingQueryResponse = await executeQuery(updateTaskTrackingQuery, updateTaskTrackingQueryParams);
                    if (updateTaskTrackingQueryResponse.changes == 1) {
                        await stopScreenShotInterval();
                        await stopAutoSyncCurrentTask(trackingId)
                        await idleTrackingStop();
                        await noTrackingReminderStart(mainWindow);
                        stopTaskWorkTimeLog(currentDateTimeInGMT);
                        stopWebAndUrlTracking();
                        ipcMain.emit('refresh-dashboard');
                        resolve(true);
                    }
                } else {
                    resolve(false);
                }
            } catch (error) {
                reject(error)
            }
        });
    });

    ipcMain.handle("update-work-entry-status", (event, taskTrackingId, workEntryMessage) => {
        return new Promise(async (resolve, reject) => {
            try {
                const updateTaskTrackingQuery  = " UPDATE task_tracking SET work_entry_status = 1, work_entry_message = ? WHERE id = ?";
                const updateTaskTrackingQueryParams = [workEntryMessage, taskTrackingId ];
                const updateTaskTrackingQueryResponse = await executeQuery(updateTaskTrackingQuery, updateTaskTrackingQueryParams);
                if (updateTaskTrackingQueryResponse.changes == 1) {
                    resolve(true);
                }
            } catch (error) {
                reject(error)
            }
        });
    });
}

module.exports = {
    taskTrackingHandlers
};
