const { BASE_URL, API_ENDPOINT, AUTO_SYNC_TIME } = require("../config");
const { executeQuery, getRows } = require("../sqlitedb/sqlitedb");
const { asyncApiRequest, intervalManager, getUserInfo } = require("./lib");

async function syncUserIdleTimeToMongoDB(userId) {
    try {
        const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_USER_IDLE_TIME;
        let recordToUpdate = {};
        const selectUserIdleTimeQuery = "SELECT * FROM user_idle_time WHERE user_id = ?";
        const selectUserIdleTimeParam = [userId];
        const selectUserIdleTimeResponses = await getRows(selectUserIdleTimeQuery, selectUserIdleTimeParam);
        if(!selectUserIdleTimeResponses) {
            return null
        }
        if (selectUserIdleTimeResponses.length > 0) {
            for (const selectUserIdleTimeResponse of selectUserIdleTimeResponses) {
                recordToUpdate = {
                    "id": selectUserIdleTimeResponse.id,
                    "user_id": selectUserIdleTimeResponse.user_id,
                    "task_id": selectUserIdleTimeResponse.task_id,
                    "start_at": selectUserIdleTimeResponse.start_at,
                    "end_at": selectUserIdleTimeResponse.end_at,
                    "status": selectUserIdleTimeResponse.status
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
                            
                            if(selectUserIdleTimeResponse.end_at != null) {
                                deleteIfFinalSyncWithMongo(res.successID);
                            }
                        }
                    }
                }
            }
        } else {
            return false;
        }
        
    } catch(e) {
        console.error(`Error syncing UserIdleTime to MongoDB:`, e);
    }
}

async function deleteIfFinalSyncWithMongo(successID) {
    try {
        const deleteUserIdleTimeQuery = "DELETE FROM user_idle_time WHERE id =?";
        const deleteUserIdleTimeParam = [successID];
        await executeQuery(deleteUserIdleTimeQuery, deleteUserIdleTimeParam);
    } catch (err) {
        console.error(`Error deleting from task_tracking:`, err);
        throw err;
    }
}

async function autoSyncUserIdleTime(taskId, userId) {
	intervalManager.startInterval(taskId + '-userIdleTime', async () => await userIdleTimeAutoSync(taskId, userId), AUTO_SYNC_TIME);
}

async function userIdleTimeAutoSync(taskId, userId) {
  try {
    const query = `UPDATE user_idle_time SET system_auto_sync_at = ? WHERE (end_at IS NULL OR end_at = '') AND task_id = ? AND user_id = ?`;
    const currentDateTimeInGMT = new Date().toISOString();
    const params = [currentDateTimeInGMT, taskId, userId];
    await executeQuery(query, params);
  } catch (error) {
    throw error;
  }
}

async function checkAndUpdateUserIdleTime() {
    try {
        const selectQuery = "SELECT * FROM user_idle_time WHERE (end_at IS NULL OR end_at = '')";
        const userIdleTimes = await getRows(selectQuery);
        if(!userIdleTimes) {
            return null
        }
        for (let userIdleTime of userIdleTimes) {
            const updateUserIdleTimeQuery = "UPDATE user_idle_time SET end_at = ? WHERE (end_at IS NULL OR end_at = '')";
            const updateUserIdleTimeParam = [userIdleTime.system_auto_sync_at];
            const updateUserIdleTimeResponse = await executeQuery(updateUserIdleTimeQuery, updateUserIdleTimeParam);
            if (updateUserIdleTimeResponse.changes == 1) {
                return true;
            }
        }
    } catch (error) {
        throw error;
    }
}

module.exports = {
    syncUserIdleTimeToMongoDB,
    autoSyncUserIdleTime,
    checkAndUpdateUserIdleTime
}