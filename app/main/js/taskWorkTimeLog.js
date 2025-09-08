const { executeQuery, getRows, getRow } = require("../sqlitedb/sqlitedb");
// const { getCurrentRunningTasks } = require("./lib");

const getCurrentWorkTimeLogId = async () => {
    try {
        const selectQuery = "SELECT id FROM task_work_time_logs WHERE (end_at IS NULL OR end_at = '') ORDER BY rowid DESC LIMIT 1";
        const currentRunningWorkTimeLog = await getRow(selectQuery)
        if(!currentRunningWorkTimeLog) {
            return null
        }
        return currentRunningWorkTimeLog.id;
    } catch (error) {
        throw error;
    }
}

async function startTaskWorkTimeLog() {
    try {
        const { getCurrentRunningTasks } = require('./lib');
        const currentRunningTask = await getCurrentRunningTasks();
        if(currentRunningTask) {
            const currentDateTimeInGMT = new Date().toISOString();
            const taskId = currentRunningTask.task_id;
            const currentRunningTaskUserId = currentRunningTask.user_id;

            const taskWorkTimeQuery = `
                INSERT INTO task_work_time_logs (task_id, user_id, start_at, end_at, system_auto_sync_at)
                VALUES (?, ?, ?, ?, ?);
            `;
            const taskWorkTimeParams = [taskId, currentRunningTaskUserId, currentDateTimeInGMT, null, currentDateTimeInGMT];
            const taskWorkTimeResponse = await executeQuery(taskWorkTimeQuery, taskWorkTimeParams);
            if (!taskWorkTimeResponse.lastId || taskWorkTimeResponse.lastId <= 0) {
                throw new Error(ERROR_MEG.WORK_LOG_ENTRY_ERROR);
            }
            return true;
        }
        
    } catch (error) {
        throw error;
    }
}

async function stopTaskWorkTimeLog(currentDateTimeInGMT) {
    try {
        const getCurrentWorkTimeId = await getCurrentWorkTimeLogId();
         const updateWorkTimeQuery = "UPDATE task_work_time_logs SET end_at = ? WHERE (end_at IS NULL OR end_at = '') AND id = ?";
         const updateWorkTimeParam = [currentDateTimeInGMT, getCurrentWorkTimeId];
         const updateWorkTimeResponse = await executeQuery(updateWorkTimeQuery, updateWorkTimeParam);
         if (updateWorkTimeResponse.changes == 1) {
            return true;
         }
    } catch (error) {
        throw error;
    }
}

async function deleteLastWorkTimeLog() {
    try {
        const getCurrentWorkTimeId = await getCurrentWorkTimeLogId();
         const deleteWorkTimeQuery = "DELETE FROM task_work_time_logs WHERE id = ?";
         const deleteWorkTimeParam = [getCurrentWorkTimeId];
         const deleteWorkTimeResponse = await executeQuery(deleteWorkTimeQuery, deleteWorkTimeParam);
         if (deleteWorkTimeResponse.changes == 1) {
            return true;
         }
    } catch (error) {
        throw error;
    }
}

const deleteOldWorkLogEntries = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            const currentDateObject = new Date();
            currentDateObject.setUTCHours(0, 0, 0, 0);

            const deleteQuery = `
            DELETE FROM task_work_time_logs 
            WHERE start_at < ?
            `;

            const deleteResponse = await executeQuery(deleteQuery, [currentDateObject.toISOString()]);

            if (deleteResponse.changes && parseInt(deleteResponse.changes) > 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        } catch (error) {
            console.error('Error deleting old work log entries:', error);
            reject('Failed to delete old work log entries');
        }
    });
};

const checkAndUpdateCurrentRunningWorkLogEntry = async () => {
    try {
        const selectQuery = "SELECT * FROM task_work_time_logs WHERE (end_at IS NULL OR end_at = '') ORDER BY rowid DESC LIMIT 1";
        const currentRunningWorkTimeLog = await getRow(selectQuery);
        if (!currentRunningWorkTimeLog) {
            return;
        }
        const updateSqlQuery = `
        UPDATE task_work_time_logs 
        SET end_at = ? 
        WHERE id = ?`;
        const updateSqlParams = [currentRunningWorkTimeLog.system_auto_sync_at, currentRunningWorkTimeLog.id];
        await executeQuery(updateSqlQuery, updateSqlParams);
    } catch (error) {
        throw error;
    }
}

const getTodaysTaskTimeById = async(taskId) => {
    try {
        const selectQuery = "SELECT * FROM task_work_time_logs WHERE task_id = ?";
        const params = [taskId];
        const trackingTime = await getRows(selectQuery, params)
        if(!trackingTime) {
            return 0
        }

        const currentTime = new Date().toISOString();
        let totalTime = 0;
        trackingTime.forEach(entry => {
            const startAt = new Date(entry.start_at);
            const endAt = entry.end_at ? new Date(entry.end_at) : new Date(currentTime);

            const duration = endAt - startAt; // Difference in milliseconds
            totalTime += duration;
        });
        let totalTimeInSeconds = Math.round(totalTime / 1000);
        return totalTimeInSeconds;
    } catch (error) {
        throw error;
    }
}

const taskWorkTimeAutoSync = async(currentDateTimeInGMT) => {
    try {
        const getCurrentWorkTimeId = await getCurrentWorkTimeLogId();
        const queryWorkTimeLog = `UPDATE task_work_time_logs SET system_auto_sync_at = ? WHERE id = ?`;
        const paramsWorkTimeLog = [currentDateTimeInGMT, getCurrentWorkTimeId];
        await executeQuery(queryWorkTimeLog, paramsWorkTimeLog);
    } catch (error) {
      throw error;
    }
}

const getTodaysTotalTaskTimeUserWise = async(userId) => {
    try {
        const selectQuery = "SELECT * FROM task_work_time_logs WHERE user_id = ?";
        const params = [userId];
        const trackingTime = await getRows(selectQuery, params)
        if(!trackingTime) {
            return 0
        }

        const currentTime = new Date().toISOString();
        let totalTime = 0;
        trackingTime.forEach(entry => {
            const startAt = new Date(entry.start_at);
            const endAt = entry.end_at ? new Date(entry.end_at) : new Date(currentTime);

            const duration = endAt - startAt; // Difference in milliseconds
            totalTime += duration;
        });
        let totalTimeInSeconds = Math.round(totalTime / 1000);
        return totalTimeInSeconds;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    startTaskWorkTimeLog,
    stopTaskWorkTimeLog,
    deleteLastWorkTimeLog,
    deleteOldWorkLogEntries,
    checkAndUpdateCurrentRunningWorkLogEntry,
    getTodaysTaskTimeById,
    taskWorkTimeAutoSync,
    getTodaysTotalTaskTimeUserWise
}