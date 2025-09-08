const { ipcMain} = require('electron/main');
const { executeQuery } = require('../sqlitedb/sqlitedb');
const { closeModalWindow, closeConfirmActivityModal, insertIdleTask } = require('../js/idleTracking');
const { getCurrentRunningTaskTrackingId, insertUserIdleTimeData } = require('../js/lib');
const { startTaskWorkTimeLog, deleteLastWorkTimeLog } = require('../js/taskWorkTimeLog');


ipcMain.handle("user-working-response", (event, workingStatus) => {
    return new Promise(async (resolve, reject) => {
        const timestamp = new Date();
        
        try {
            const currentDateTimeInGMT = timestamp.toISOString();
            
            const currentTaskTrackId = await getCurrentRunningTaskTrackingId();
            if (workingStatus == 'working') {
                const updateQuery = "UPDATE task_time_segment SET mode='manual', end_at = ? WHERE mode = 'idle' AND (end_at IS NULL OR end_at = '') AND task_tracking_id = ?";
                const updateParam = [currentDateTimeInGMT, currentTaskTrackId];
                const updateResponse = await executeQuery(updateQuery, updateParam);
                if(updateResponse.changes) {
                    await insertIdleTask(timestamp, workingStatus);
                    await insertUserIdleTimeData(timestamp, workingStatus);
                }
            } else if (workingStatus == 'not-working') {
                const deleteQuery = "DELETE from task_time_segment WHERE mode = 'idle' AND (end_at IS NULL OR end_at = '') AND task_tracking_id = ?";
                const deleteParam = [currentTaskTrackId];
                const deleteResponse = await executeQuery(deleteQuery, deleteParam);
                
                if(deleteResponse.changes) {
                    await insertIdleTask(timestamp, 'working');
                    await insertUserIdleTimeData(timestamp, workingStatus);
                    await deleteLastWorkTimeLog();
                    await startTaskWorkTimeLog();                    
                }
            }
        } catch (error) {
            reject(error);
        } finally {
            await closeModalWindow();
            if(workingStatus == 'not-working') {
                ipcMain.emit('refresh-dashboard');
            }
        }
    });
});

ipcMain.handle("idle-detection", (event) => {
    closeConfirmActivityModal(true);
});

ipcMain.handle("active-detection", (event) => {
    closeConfirmActivityModal(false);
});