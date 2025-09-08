const { getUserSettings, getUserInfo, intervalManager, getCurrentRunningTasks, getCurrentRunningBreak } = require('./lib');
const { USER_SETTINGS_CONSTANTS, ERROR_MEG } = require('../config');

const noTrackingReminderStart = async (parentWindow) => {
    try {
        const userSettings = await getUserSettings();
        if (userSettings && userSettings[0] && userSettings[0][USER_SETTINGS_CONSTANTS.no_tracking_reminder] !== undefined) {
            const noTrackingReminderTime = userSettings[0][USER_SETTINGS_CONSTANTS.no_tracking_reminder];

            if (noTrackingReminderTime > 0) {
                const userInfo = await getUserInfo();
                intervalManager.startInterval(userInfo.user.user_id+'-noTrackingReminder', () => noTrackingReminderCallbackFunction(parentWindow), noTrackingReminderTime * 1000);
            }
        }
    } catch (e) {
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
};

const noTrackingReminderCallbackFunction = async (parentWindow) => {
    try {
        const userInfo = await getUserInfo();
        const userId = userInfo.user.user_id;
        const currentBreak = await getCurrentRunningBreak(userId);
        const currentRunningTask = await getCurrentRunningTasks();

        if (!currentRunningTask && currentBreak == null) {
            parentWindow.show();
            parentWindow.webContents.send('user-no-tracking-reminder', { noTrackingReminderBlock: 'd-block' });
        } else {
            parentWindow.webContents.send('user-no-tracking-reminder', { noTrackingReminderBlock: 'd-none' });
        }
    }catch (e) {
        console.error('Error checkNoTrackingReminder:', e);
    }
};

const noTrackingReminderStop = async (parentWindow) => {
    const userInfo = await getUserInfo();
    await intervalManager.stopInterval(`${userInfo.user.user_id}-noTrackingReminder`);
    parentWindow.webContents.send('user-no-tracking-reminder', { noTrackingReminderBlock: 'd-none' });
};

module.exports = {
    noTrackingReminderStart,
    noTrackingReminderStop
}