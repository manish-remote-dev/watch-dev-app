const { BASE_URL, API_ENDPOINT, ERROR_MEG } = require("../config");
const { executeQuery, getRows } = require("../sqlitedb/sqlitedb");
const { asyncApiRequest } = require("./lib");

const syncScrumEntryToMongoDB = async (userId) => {
    return new Promise(async (resolve, reject) => {
        try {      
            const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_SCRUM_ENTRY;
            const selectQuery = "SELECT * FROM scrum_entry WHERE is_synced = 0 AND user_id = ?";
            const selectParam = [userId];
            const scrumEntryResponses = await getRows(selectQuery, selectParam);
            if(!scrumEntryResponses) {
                return null
            }
    
            if (scrumEntryResponses.length > 0) {
                for (const scrumEntry of scrumEntryResponses) {
                    if (scrumEntry && Object.keys(scrumEntry).length > 0) {
                        const payload = {
                            id: scrumEntry.id,
                            user_id: scrumEntry.user_id,
                            worked_date: new Date(scrumEntry.worked_date),
                            project_id: scrumEntry.project_id,
                            task_id: scrumEntry.task_id,
                            scrum_message: scrumEntry.scrum_message,
                            expected_spent_time: scrumEntry.expected_spent_time? parseInt(scrumEntry.expected_spent_time) : 0
                        };
                        const requestInfo = {
                            method: "POST",
                            url: url,
                            authType: 'bearertoken',
                            requestData: payload
                        };
                        const result = await asyncApiRequest(requestInfo);
        
                        if (result.data && result.data.data) {
                            const res = result.data.data;
                            if (res.successIDs && res.successIDs.length > 0) {
                                const updateQuery = "UPDATE scrum_entry SET is_synced = 1 WHERE id = ?";
                                const updateParam = res.successIDs;
                                await executeQuery(updateQuery, updateParam);
                            }
                        }
                    }
                }
                resolve(true);
            } else {
                resolve(false);
            }

            
        } catch (error) {
            console.error('Error syncScrumEntryToMongoDB:', error);
            reject(ERROR_MEG.INTERNAL_ERROR);
        }
    });
};

const deleteOldScrumEntries = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            const currentDateObject = new Date();
            currentDateObject.setDate(currentDateObject.getDate() - 2);

            const twoDaysBeforeDate = currentDateObject.toISOString().split('T')[0];

            const deleteQuery = `
            DELETE FROM scrum_entry 
            WHERE worked_date <= ?
            `;

            const deleteResponse = await executeQuery(deleteQuery, [twoDaysBeforeDate]);

            if (deleteResponse.changes && parseInt(deleteResponse.changes) > 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        } catch (error) {
            console.error('Error deleting old scrum entries:', error);
            reject('Failed to delete old scrum entries');
        }
    });
};

module.exports = {
    syncScrumEntryToMongoDB,
    deleteOldScrumEntries
};
