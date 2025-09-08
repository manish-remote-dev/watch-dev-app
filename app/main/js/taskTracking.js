const { BASE_URL, API_ENDPOINT } = require("../config");
const { executeQuery } = require("../sqlitedb/sqlitedb");
const { getRows } = require("../sqlitedb/sqlitedb");
const { asyncApiRequest } = require("./lib");

async function syncTaskTrackingToMongoDB(userId) {
    try {
        const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_TASK_TRACKING;
        let recordToUpdate = {};
        const selectTaskQuery = "SELECT * FROM task_tracking WHERE final_sync_with_mongo = 0 AND user_id = ?";
        const selectTaskParam = [userId];
        const selectTaskResponses = await getRows(selectTaskQuery, selectTaskParam);
        if(!selectTaskResponses) {
            return null
        }

        if (selectTaskResponses.length > 0) {
            for (const selectTaskResponse of selectTaskResponses) {
                recordToUpdate = {
                    "id": selectTaskResponse.id,
                    "task_id": selectTaskResponse.task_id,
                    "task_title": selectTaskResponse.task_title,
                    'project_id': selectTaskResponse.project_id,
                    "project_name": selectTaskResponse.project_name,
                    "user_id": selectTaskResponse.user_id,
                    "user_name": selectTaskResponse.user_name,
                    "system_auto_sync_at": selectTaskResponse.system_auto_sync_at,
                    "work_entry_status": selectTaskResponse.work_entry_status,
                    "work_entry_message": selectTaskResponse.work_entry_message,
                    "inserted_at": selectTaskResponse.created_at,
                    "working_status": [],
                    "team_id": selectTaskResponse.team_id,
                    "team_name": selectTaskResponse.team_name,
                }
        
                const selectTaskTimeSegmentQuery = "SELECT start_at, end_at, mode FROM task_time_segment WHERE task_tracking_id = ?";
                const selectTaskTimeSegmentParam = [selectTaskResponse.id];
                const selectTaskTimeSegmentResponse = await getRows(selectTaskTimeSegmentQuery, selectTaskTimeSegmentParam);
        
                recordToUpdate.working_status = selectTaskTimeSegmentResponse;
        
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
                            if(selectTaskResponse.partial_sync_with_mongo == 0) {
                                await updatePartialSyncWithMongo(res.successID);
                            }
                            if(selectTaskResponse.is_finished == 1) {
                                const updateResponse = await updateFinalSyncWithMongo(res.successID);
                                if(updateResponse) {
                                    deleteIfFinalSyncWithMongo(res.successID);
                                }
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

async function updatePartialSyncWithMongo(successID) {
    try {
        const updateQuery = "UPDATE task_tracking SET partial_sync_with_mongo = 1 WHERE id = ?";
        const updateParam = [successID];
        await executeQuery(updateQuery, updateParam);
    } catch (err) {
        console.error(`Error updating partial_sync_with_mongo in task_tracking:`, err);
        throw error;
    }
}

async function updateFinalSyncWithMongo(successID) {
    try {
        const updateQuery = "UPDATE task_tracking SET final_sync_with_mongo = 1 WHERE id = ?";
        const updateParam = [successID];
        updateResponse = await executeQuery(updateQuery, updateParam);

        if(updateResponse.changes) {
            return true;
        }
    } catch (err) {
        console.error(`Error updating final_sync_with_mongo in task_tracking:`, err);
        throw error;
    }
}

async function deleteIfFinalSyncWithMongo(successID) {
    try {
        const deleteTaskTrackingQuery = "DELETE FROM task_tracking WHERE id =?";
        const deleteTaskTrackingParam = [successID];
        await executeQuery(deleteTaskTrackingQuery, deleteTaskTrackingParam);

        const deleteTaskTimeSegmentQuery = "DELETE FROM task_time_segment WHERE task_tracking_id =?";
        const deleteTaskTimeSegmentParam = [successID];
        await executeQuery(deleteTaskTimeSegmentQuery, deleteTaskTimeSegmentParam);
    } catch (err) {
        console.error(`Error deleting from task_tracking:`, err);
        throw error;
    }
}

module.exports = {
    syncTaskTrackingToMongoDB,
}