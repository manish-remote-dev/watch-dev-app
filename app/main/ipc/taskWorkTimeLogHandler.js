const { ipcMain } = require("electron");
const { getTodaysTaskTimeById, getTodaysTotalTaskTimeUserWise } = require("../js/taskWorkTimeLog");

ipcMain.handle("get-task-work-log", (event, taskId) => {
    return new Promise( async (resolve, reject) => {
        try {
            const workLogTime = await getTodaysTaskTimeById(taskId);
            resolve(workLogTime);
        } catch (error) {
            reject(error);
        }
    });
});

ipcMain.handle("get-todays-total-task-time", (event, userId) => {
    return new Promise( async (resolve, reject) => {
        try {
            const todaysTaskTime = await getTodaysTotalTaskTimeUserWise(userId);
            resolve(todaysTaskTime);
        } catch (error) {
            reject(error);
        }
    });
});