const { ipcMain} = require('electron/main');
const { asyncApiRequest, setUserInfo, getUserInfo, clearUserInfo, getUserSettings, setUserSettings, intervalManager, checkConnectivity, logInternetLostError, getPrimaryTeam, checkAndUpdateCurrentRunningTask} = require('../js/lib');
const keytar = require('keytar');
const { KEYTAR_AUTH_DATA, ERROR_MEG } = require('./../config');
const { getRow } = require('./../sqlitedb/sqlitedb');
const { updateURLofTrackedWebsite, syncWebAndAppWithCloud, processWebUrlTrackingSummary } = require('../js/webAndUrlTracking')

ipcMain.handle('make-async-api-request', async (event, requestInfo) => {
  try {
    const response = await asyncApiRequest(requestInfo);
    if (response.statusCode == 401) {
      ipcMain.emit('logout');
    }
    return response;
  } catch (error) {
    if(error.message == 'net::ERR_CONNECTION_REFUSED') {
      throw new Error(ERROR_MEG['net::ERR_CONNECTION_REFUSED']);
    }
    if(error.message == 'net::ERR_INTERNET_DISCONNECTED') {
      throw new Error(ERROR_MEG['net::ERR_INTERNET_DISCONNECTED']);
    }
    throw new Error(ERROR_MEG.INTERNAL_ERROR);
  }
})

ipcMain.handle('login-success', async (event, userData) => {
  try {
    await keytar.setPassword(KEYTAR_AUTH_DATA.SERVICE, KEYTAR_AUTH_DATA.ACCOUNT, userData.access_token);
    const setUserInfoData = await setUserInfo(userData)
    // await setUserSettings();
    if (setUserInfoData) {
      ipcMain.emit('redirect-dashboard');
    }
  } catch (error) {
    throw new Error(ERROR_MEG.INTERNAL_ERROR);
  }
});

ipcMain.handle('get-user-info', async () => {
  try {
    const userInfo = await getUserInfo()
    return userInfo;
  } catch (error) {
    reject(new Error(ERROR_MEG.INTERNAL_ERROR));
  }
})

ipcMain.on('logout', async () => {
  let logoutKeytar;
  let clearUserInfoData;
  try {
    logoutKeytar = await keytar.deletePassword(KEYTAR_AUTH_DATA.SERVICE, KEYTAR_AUTH_DATA.ACCOUNT);
    clearUserInfoData = await clearUserInfo();
    await intervalManager.clearAllIntervals();
    // if (logoutKeytar && clearUserInfoData) {
    //   ipcMain.emit('redirect-login');
    // }
    // if(logoutKeytar == false & clearUserInfoData == true) {
    //   ipcMain.emit('redirect-login');
    // }
    if (clearUserInfoData) {
      ipcMain.emit('redirect-login');
    }
  } catch (error) {
    throw new Error(ERROR_MEG.INTERNAL_ERROR);
  }
});

ipcMain.handle('get-user-settings', async () => {
  try {
    const userSettings = await getUserSettings()
    return userSettings;
  } catch (error) {
    reject(new Error(ERROR_MEG.INTERNAL_ERROR));
  }
});

ipcMain.handle("get-row-from-local-db", async (event, query, params=[]) => {
  try {
    return await getRow(query, params)
  } catch (error) {
    throw new Error(ERROR_MEG.INTERNAL_ERROR);
  }
});

 ipcMain.handle('checkInternetConnectivity', async () => {
  return await checkConnectivity();
});

ipcMain.handle('logNetStatusChangeData', async (event, status) => {
   logInternetLostError(status)
});

ipcMain.on('no-internet', async () => {
  ipcMain.emit('redirect-dashboard');
});

ipcMain.handle('update-primary-team', async()=>{
  const primaryTeam = await getPrimaryTeam();
  const userInfo = await getUserInfo();
  userInfo.team_id = primaryTeam;
  return await setUserInfo(userInfo);
});

ipcMain.handle('stop-current-running-task-in-background', async() => {
  return await checkAndUpdateCurrentRunningTask();
});