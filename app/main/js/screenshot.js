
const { desktopCapturer } = require('electron');
const { ERROR_MEG, BASE_URL, API_ENDPOINT, USER_SETTINGS_CONSTANTS } = require('../config');
const { executeQuery, getRows } = require('../sqlitedb/sqlitedb');
const { getUserInfo, asyncApiRequest, getUserSettings, intervalManager, getCurrentRunningTasks } = require('./lib');

const captureScreenShot = async () => {
    try {
        const userSettings = await getUserSettings();
        const screenshotInterval = userSettings[0][USER_SETTINGS_CONSTANTS.screencast_interval];

        if (screenshotInterval > 0) {
            const userInfo = await getUserInfo();
            intervalManager.startInterval(userInfo.user.user_id + '-screenshot', () => captureUserScreen(userInfo.user.user_id, screenshotInterval), screenshotInterval * 1000);
        }
    } catch (error) {
        console.error('Error captureScreenShot:', error);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
};

const captureUserScreen = async (currentUserId, runningInterval) => {
    try {
        const currentRunningTask = await getCurrentRunningTasks();
        if (currentRunningTask && currentRunningTask.id) {
            const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
            if (sources.length === 0) {
                throw new Error('No screen sources available.');
            }
            
            const screen = sources[0];
            const screenData = screen.thumbnail.toDataURL();
            await storeScreenShot(screenData, currentUserId);
            //await syncScreenShotToMongo();
            await recheckScreenShotInterval(currentUserId, runningInterval);//After taking screenshot it checks the current status, so that its getting off or time has been changed
        }
        
    } catch (error) {
        console.error('Error capturing user screen:', error);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
}

const storeScreenShot = async (data, currentUserId) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (currentUserId) {
                const payload = {
                    user_id: currentUserId,
                    screen_base64: data,
                    captured_at: new Date().toISOString()
                };

                const sqlQuery = "INSERT INTO screenshot_logs (user_id, screen_base64, captured_at) VALUES (?, ?, ?)";
                const sqlParams = [payload.user_id, payload.screen_base64, payload.captured_at];
                const screenshotResponse = await executeQuery(sqlQuery, sqlParams)
                if( screenshotResponse.lastId && screenshotResponse.lastId > 0) {
                    resolve (true)
                }
            }
        } catch (error) {
            console.error('Error storeScreenShot:', error);
            reject(ERROR_MEG.INTERNAL_ERROR);
        }
    });
};

const syncScreenShotToMongo = async () => {
    try {
        const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_SCREEN_SHOT;
        const userInfo = await getUserInfo();
        const user_id = userInfo.user.user_id;

        const selectQuery = "SELECT * FROM screenshot_logs WHERE is_synced = 0 AND user_id = ?";
        const selectParam = [user_id];
        const screenShots = await getRows(selectQuery, selectParam);
        if (screenShots.length > 0) {
            for (const row of screenShots) {
                const payload = {
                    id: row.id,
                    user_id: row.user_id,
                    captured_at: row.captured_at,
                    image: row.screen_base64
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
                        const successIDs = res.successIDs;
                        const placeholders = successIDs.map(() => '?').join(',');
                        const sqlQuery = `DELETE FROM screenshot_logs WHERE id IN (${placeholders})`;
                        await executeQuery(sqlQuery, successIDs);
                    }
                }
                else {
                    console.log('error uploading screenshot', result.data.errors);
                }
            }
        }
    } catch (error) {
        console.error('Error syncScreenShot:', error);
    }
};

const recheckScreenShotInterval = async (currentUserId, runningInterval) => {
    try {
        const userSettings = await getUserSettings();
        const nextInterval = userSettings[0].screencast_interval;

        if(nextInterval>0) {
            if(nextInterval != runningInterval) {
                await intervalManager.stopInterval(currentUserId+'-screenshot');
            }
            intervalManager.startInterval(currentUserId+'-screenshot', () => captureUserScreen(currentUserId, nextInterval), nextInterval * 1000);
        } else {
            await intervalManager.stopInterval(currentUserId+'-screenshot');
        }
    } catch (error) {
        console.error('Error recheckScreenShotInterval:', error);
        throw new Error(ERROR_MEG.INTERNAL_ERROR);
    }
}

const stopScreenShotInterval = async () => {
    const userInfo = await getUserInfo();
	intervalManager.stopInterval(userInfo.user.user_id + '-screenshot');
}

module.exports = {
    captureScreenShot,
    syncScreenShotToMongo,
    stopScreenShotInterval
};