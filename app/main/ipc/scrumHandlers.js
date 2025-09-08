const { ipcMain } = require("electron");
const { executeQuery, getRow } = require('./../sqlitedb/sqlitedb');
const { getUserInfo } = require('./../js/lib')

ipcMain.handle("scrum-entry", async (event, scrumTaskDetails) =>{
    return new Promise(async (resolve, reject) => {
        try {
            const userInfo = await getUserInfo();
            const userId = userInfo.user.user_id;
            const { project_id, project_name, task_id, scrum_message, expected_spent_time, team_id, team_name } = scrumTaskDetails;
            const currentDateTimeInGMT = new Date().toISOString();
            const currentDate = currentDateTimeInGMT.split('T')[0];
            const upsertQuery = `
                INSERT INTO scrum_entry (user_id, worked_date, project_id, project_name, task_id, scrum_message, expected_spent_time, created_at, updated_at, team_id, team_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id, worked_date) DO UPDATE SET
                    project_id = excluded.project_id,
                    scrum_message = excluded.scrum_message;                    
            `;
            const upsertParams = [userId, currentDate, project_id, project_name, task_id, scrum_message, expected_spent_time, currentDateTimeInGMT, currentDateTimeInGMT, team_id, team_name];
            const scrumEntryResponse = await executeQuery(upsertQuery, upsertParams)
            if( scrumEntryResponse.lastId ) {
                resolve ({'scrumEntryId' : scrumEntryResponse.lastId})
            }
            if( scrumEntryResponse.changes && parseInt(scrumEntryResponse.changes) > 0 ) {
                const selectQuery = `SELECT id FROM scrum_entry WHERE task_id = ? AND worked_date = ? AND user_id = ?;`;
                const selectParams = [task_id, currentDate, userId];
                const scrumEntryId = await getRow(selectQuery, selectParams)
                resolve({'scrumEntryId' : scrumEntryId.id})
            }
        } catch (error) {
            reject(error);
        }
    })
})

ipcMain.handle("delete-scrum-entry", async (event, scrumEntryId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const deleteQuery = `DELETE FROM scrum_entry WHERE id =?;`;
            const deleteParams = [scrumEntryId];
            const deleteResponse = await executeQuery(deleteQuery, deleteParams)
            resolve(deleteResponse.changes);
        } catch (error) {
            reject(error);
        }
    })
})