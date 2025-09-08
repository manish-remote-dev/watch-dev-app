const { net } = require('electron');
const keytar = require('keytar');
const storage = require('electron-json-storage');
const {
  KEYTAR_AUTH_DATA,
  ERROR_MEG,
  BASE_URL,
  API_ENDPOINT,
  AUTO_SYNC_TIME
} = require('../config');
const { executeQuery, getRow, getRows } = require('./../sqlitedb/sqlitedb');
const { taskWorkTimeAutoSync } = require('./taskWorkTimeLog');

const validateAccessToken = async (accessToken) => {
  try {
      const requestInfo = {
          method: "GET",
          url: BASE_URL.ACCOUNT_API_BASE_URL + API_ENDPOINT.USER_PROFILE,
          authType: "bearertoken",
      }
      const response = await asyncApiRequest(requestInfo);
      if (response.data.data) {
          return true;
      } else {
          return false;
      }
  } catch (error) {
      return false;
  }
}

const asyncApiRequest = async (requestInfo) => {
    return new Promise(async (resolve, reject) => {
        try {
            let url = new URL(requestInfo.url);
            if (requestInfo.queryParams) {
                for (const [key, value] of Object.entries(requestInfo.queryParams)) {
                    url.searchParams.append(key, value);
                }
            }
            const request = net.request({
                "method": requestInfo.method,
                "url": url.toString()
            });
            if (requestInfo.authType && requestInfo.authType === "basic") {
                request.setHeader("Authorization", "Basic " + btoa(requestInfo.requestData.userName + ":" + requestInfo.requestData.password));
            }
            if (requestInfo.authType && requestInfo.authType === "bearertoken") {
                const accessToken = await keytar.getPassword(KEYTAR_AUTH_DATA.SERVICE, KEYTAR_AUTH_DATA.ACCOUNT) ?? "";
                request.setHeader("Authorization", "Bearer " + accessToken);
            }
            request.setHeader("Content-Type", 'application/json');
            if (requestInfo.headers) {
                for (const [key, value] of Object.entries(requestInfo.headers)) {
                    request.setHeader(key, value);
                }
            }
            if (requestInfo.requestData && requestInfo.method !== 'GET') {
                request.write(JSON.stringify(requestInfo.requestData));
            }

            request.on('response', (response) => {
                let responseBody = Buffer.alloc(0);
                response.on('data', (chunk) => {
                    responseBody = Buffer.concat([responseBody, chunk]);
                });
                response.on('end', () => {
                    try {
                            const data = JSON.parse(responseBody.toString());
                            resolve({
                                statusCode: response.statusCode,
                                headers: response.headers,
                                data
                            });
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            request.on("error", (error) => {
                reject(error);
            });
            request.end();
        } catch (error) {
            reject(error);
        }
    });
}

const setUserInfo = async (userInfoData) => {
  return new Promise(async (resolve, reject) => {
      storage.set('user_info', userInfoData, (error) => {
          if (error) {
            reject(new Error('Failed to set user information: ' + error.message));
          } else {
            resolve(true);
          }
      });
  });
}

const getUserInfo = async () => {
    try {
        return new Promise((resolve, reject) => {
            storage.get('user_info', (error, data) => {
                if (error) {
                    reject(new Error('Failed to retrieve user information: ' + error.message));
                } else {
                    resolve(data);
                }
            });
        });
    } catch (error) {
        throw error;
    }
  
}

const clearUserInfo = async () => {
  return new Promise((resolve, reject) => {
      storage.clear('user_info', (error) => {
          if (error) {
              reject(error);
          } else {
              resolve(true);
          }
      });
  });
}

const setUserSettings = async () => {
    try {
        const userInfo = await getUserInfo();
        if(Object.keys(userInfo).length === 0 && userInfo.constructor === Object) {
            throw new Error(ERROR_MEG.INTERNAL_ERROR);
        }
        const user_id = userInfo.user.user_id;
        
        const requestInfo = {
            method: "GET",
            url: BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.USER_SETTINGS + '?id=' + user_id,
            authType: 'bearertoken',
        }
        const result = await asyncApiRequest(requestInfo);
        if (result.data.errors) {
            throw new Error(result.data.errors[0].message)
        }

        let userSettingsData = '';

        if (result.data.data && result.data.data.userSettingsList) {
            userSettingsData = result.data.data.userSettingsList;
        }

        return new Promise( async (resolve, reject) => {
            storage.set('user_settings', userSettingsData, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
        
    } catch (error) {
        throw error;
    }
  
}

const getUserSettings = async () => {
  return new Promise((resolve, reject) => {
      storage.get('user_settings', (error, data) => {
          if (error) {
              reject(new Error(ERROR_MEG.INTERNAL_ERROR));
          } else {
              resolve(data);
          }
      });
  });
}

const getCurrentRunningTasks = async () => {
    try {
        const selectQuery = "SELECT * FROM task_tracking WHERE is_finished = 0 ORDER BY rowid DESC LIMIT 1";
        const currentRunningTask = await getRow(selectQuery)
        if(!currentRunningTask) {
            return null
        }
        return currentRunningTask;
    } catch (error) {
        throw error;
    }
}

const getCurrentRunningTaskTrackingId = async () => {
    try {
        const selectQuery = "SELECT id FROM task_tracking WHERE is_finished = 0 ORDER BY rowid DESC LIMIT 1";
        const currentRunningTask = await getRow(selectQuery)
        if(!currentRunningTask) {
            return null
        }
        return currentRunningTask.id;
    } catch (error) {
        throw error;
    }
}

const intervalManager = {
  intervals: {},
  startInterval(uniqueId, callback, intervalTime) {
      if (this.intervals[uniqueId]) {
        //console.log(`Interval already running. Unique Id: ${uniqueId}`);
        return;
      }
      const intervalId = setInterval(callback, intervalTime);
      this.intervals[uniqueId] = intervalId;
      //console.log(`Started interval. Unique Id: ${uniqueId} Interval ID: ${intervalId}.`);
  },
  stopInterval(uniqueId) {
      const intervalId = this.intervals[uniqueId];
      if (intervalId) {
          clearInterval(intervalId);
          delete this.intervals[uniqueId];
          //console.log(`Stopped interval. Unique Id: ${uniqueId} Interval ID: ${intervalId}.`);
      } else {
        //console.log(`No interval found for ${uniqueId}.`);
      }
  },
  clearAllIntervals() {
    for (const uniqueId in this.intervals) {
        clearInterval(this.intervals[uniqueId]);
        // console.log(`Stopped interval. Unique Id: ${uniqueId} Interval ID: ${this.intervals[uniqueId]}.`);
        delete this.intervals[uniqueId];
    }
    //console.log('All intervals cleared.');
  }
};

async function startAutoSyncCurrentTask(trackingId) {
	intervalManager.startInterval(trackingId + '-taskStart', async () => await taskAutoSync(trackingId), AUTO_SYNC_TIME);
}

async function taskAutoSync(trackingId) {
  try {
    const query = `UPDATE task_tracking SET system_auto_sync_at = ? WHERE id = ?`;
    const currentDateTimeInGMT = new Date().toISOString();
    const params = [currentDateTimeInGMT, trackingId];
    await executeQuery(query, params);

    await taskWorkTimeAutoSync(currentDateTimeInGMT);

  } catch (error) {
    throw error;
  }
}

async function checkAndUpdateCurrentRunningTask() {
    try {
        const currentRunningTask = await getCurrentRunningTasks();
        if (!currentRunningTask) {
            return;
        }
        const trackingId = currentRunningTask.id;
        const currentRunningTaskLastSystemSyncTime = currentRunningTask.system_auto_sync_at;
        const updateTimeSegmentQuery = "UPDATE task_time_segment SET end_at = ? WHERE (end_at IS NULL OR end_at = '') AND task_tracking_id = ?";
        const updateTimeSegmentParam = [currentRunningTaskLastSystemSyncTime, trackingId];
        const updateTimeSegmentResponse = await executeQuery(updateTimeSegmentQuery, updateTimeSegmentParam);
        if (updateTimeSegmentResponse.changes == 1) {
            const updateTaskTrackingQuery  = " UPDATE task_tracking SET is_finished = 1 WHERE id = ?";
            const updateTaskTrackingQueryParams = [trackingId];
            const updateTaskTrackingQueryResponse = await executeQuery(updateTaskTrackingQuery, updateTaskTrackingQueryParams);
            if (updateTaskTrackingQueryResponse.changes == 1) {
                return true;
            }
        }
    } catch (error) {
        throw error;
    }
}

async function makeDefaultWorkEntry(currentRunningTaskId, startAt, lastSystemSyncAt) {

    try {
        const selectScrumQuery = "SELECT * FROM scrum_entry WHERE task_id = ? ORDER BY id DESC LIMIT 1";
        const selectScrumParam = [currentRunningTaskId];
        const selectScrumResponse = await getRow(selectScrumQuery, selectScrumParam);

        if(!selectScrumResponse) {
            return false;
        }
        return selectScrumResponse.scrum_message;
        /*startAt = new Date(startAt);
        const endAt = new Date(lastSystemSyncAt);
        const duration = endAt - startAt;
        const durationInHours = (duration / (1000 * 60 * 60)).toFixed(2);

        const payload = {
            "worked_date": startAt,
            "project_id": selectScrumResponse.project_id,
            "task_id": currentRunningTaskId,
            "worked_hour": durationInHours,
            "comment": selectScrumResponse.scrum_message
        }

        const postWorkEntryRequestInfo = {
            method: "POST",
            url: BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.WORK_ENTRY,
            authType: 'bearertoken',
            requestData: payload
        };
        const postWorkEntryResult = await asyncApiRequest(postWorkEntryRequestInfo);
        if (postWorkEntryResult.data && postWorkEntryResult.data.data) {
            return selectScrumResponse.scrum_message;
        } else {
            return false;
        }*/
    } catch (error) {
        console.error(`Error making default work entry:`, error);
        throw error;
    }
}

const checkConnectivity = async () => {
    try {
        await new Promise(sleep => setTimeout(sleep, 2000));
        const response = await fetch('https://www.google.com/', { method: 'HEAD' });
        return response.ok ? true : false;
    } catch (error) {
        return false;
    }
}

const logInternetLostError = async (status) => {
    const timestamp = new Date().toISOString();
    
    const userInfo = await getUserInfo();
    const user_id = userInfo.user.user_id;
    const fullName = `${userInfo.user.first_name} ${userInfo.user.last_name}`;

    if (status === "offline") {
        const query = `INSERT INTO internet_connectivity_lost_logs (user_id, user_name, system_auto_sync_at, start_at) VALUES (?, ?, ?, ?)`;
        const params = [user_id, fullName, timestamp, timestamp];
        //executeQuery(query, params);
        const connectivityLossResponse = await executeQuery(query, params);
        if( connectivityLossResponse.lastId ) {
            intervalManager.startInterval(connectivityLossResponse.lastId + '-connectivityLoss', async () => await connectivityLossAutoSync(connectivityLossResponse.lastId), AUTO_SYNC_TIME);
        }        
    } else {
        // console.log("CURRENTLY ONLINE FROM LIB.js")
        const selectConnectivityLossQuery = `SELECT id FROM internet_connectivity_lost_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1`;
        const selectConnectivityLossParam = [user_id];
        const selectConnectivityLossResponse = await getRow(selectConnectivityLossQuery, selectConnectivityLossParam);

        if(!selectConnectivityLossResponse) {
            console.error('No record found to update.');
            return null
        }
        if (selectConnectivityLossResponse.id) {
            const query = `UPDATE internet_connectivity_lost_logs SET end_at = ? WHERE id = ?`;
            const params = [timestamp, selectConnectivityLossResponse.id];
            executeQuery(query, params);
            stopAutoSyncCurrentConnectivityLoss(selectConnectivityLossResponse.id);
        }
    }
};

async function getUnfinishedTaskTrackingDetails(taskId) {
    try {
        const selectQuery = "SELECT * FROM task_tracking WHERE task_id = ? and is_finished = 0 ORDER BY rowid DESC LIMIT 1";
        const params = [taskId];
        const taskTrackingDetails = await getRow(selectQuery, params)
        if(!taskTrackingDetails) {
            return null
        }
        return taskTrackingDetails;
    } catch (error) {
        throw error;
    }
}

async function getTaskTrackedTime(trackingId) {
    try {
        const selectQuery = "SELECT * FROM task_time_segment WHERE task_tracking_id = ?";
        const params = [trackingId];
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

async function insertUserIdleTimeData(idleStartTime, mode = null) {
    try {
        const currentTaskTrackId = await getCurrentRunningTaskTrackingId();
        const formattedIdleStartTime = idleStartTime.toISOString();
        let status = '';
        if (mode == 'idle') {
            status = 'Initiated as idle';
        } else if (mode == 'working') {
            status = 'Changed to working';
        } else {
            status = 'Changed to not working';
        }

        const selectQuery = "SELECT * FROM task_tracking WHERE id = ?";
        const params = [currentTaskTrackId];
        const taskTrackingDetails = await getRow(selectQuery, params);
        if (!taskTrackingDetails) {
            return null;
        }
        
        const taskTrackingId = taskTrackingDetails.id;

        if (mode == 'idle') {
            const userIdleTimeQuery = `INSERT INTO user_idle_time (user_id, task_id, task_tracking_id, start_at, end_at, system_auto_sync_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
            const userIdleTimeParams = [taskTrackingDetails.user_id, taskTrackingDetails.task_id, taskTrackingId, formattedIdleStartTime, null, formattedIdleStartTime, status, formattedIdleStartTime, formattedIdleStartTime];
            const userIdleTimeResponse = await executeQuery(userIdleTimeQuery, userIdleTimeParams);
            if (userIdleTimeResponse.lastId && userIdleTimeResponse.lastId > 0) {
                return true;
            }
        } else if (mode == 'working' || mode == 'not-working') {
            const fetchIdleTimeQuery = `SELECT * FROM user_idle_time WHERE task_tracking_id = ? ORDER BY start_at DESC LIMIT 1`;
            const fetchIdleTimeParams = [taskTrackingId];
            const idleTimeDetails = await getRow(fetchIdleTimeQuery, fetchIdleTimeParams);

            if (idleTimeDetails) {
                const updateUserIdleTimeQuery = `UPDATE user_idle_time SET end_at = ?, status = ? WHERE id = ?`;
                const currentDateTimeInGMT = new Date().toISOString();
                const updateUserIdleTimeParam = [currentDateTimeInGMT, status, idleTimeDetails.id];
                const updateUserIdleTimeResponse = await executeQuery(updateUserIdleTimeQuery, updateUserIdleTimeParam);
                // console.log("updateUserIdleTimeResponse", updateUserIdleTimeResponse);
            } else {
                // console.log("No matching idle time record found for update.");
            }
        }
    } catch (error) {
        console.error("Error in insertUserIdleTimeData:", error);
        throw error;
    }
}

async function stopAutoSyncCurrentTask(trackingId) {
	intervalManager.stopInterval(trackingId + '-taskStart');
}

async function connectivityLossAutoSync(recordTrackingId) {
    try {
      const query = `UPDATE internet_connectivity_lost_logs SET system_auto_sync_at = ? WHERE id = ?`;
      const currentDateTimeInGMT = new Date().toISOString();
      const params = [currentDateTimeInGMT, recordTrackingId];
      await executeQuery(query, params);
    } catch (error) {
      throw error;
    }
}

async function stopAutoSyncCurrentConnectivityLoss(recordTrackingId) {
	intervalManager.stopInterval(recordTrackingId + '-connectivityLoss');
}

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

const getCurrentTimeInMicroseconds = () => {
    const baseUnixEpochInMilliseconds = new Date().getTime(); // Base Unix time when the script starts
    const baseHighPrecision = performance.now(); // High-precision timer start point
    const elapsedMicroseconds = Math.floor((performance.now() - baseHighPrecision) * 1000);
    const currentTimeInMicroseconds = baseUnixEpochInMilliseconds * 1000 + elapsedMicroseconds;
    return currentTimeInMicroseconds;
}

async function getBaseURL(fullURL) {
    try {
        // Add default protocol if missing
        if (!fullURL.startsWith('http://') && !fullURL.startsWith('https://')) {
            fullURL = 'http://' + fullURL; // Assume HTTP if no protocol
        }
        const url = new URL(fullURL); // Parse the URL
        return url.origin;           // Get the base URL
    } catch (error) {
        return null;
    }
}

async function getCurrentRunningBreak(userId) {
    try {
        const selectQuery = "SELECT break_id FROM break_log WHERE user_id = ? and end_at is null";
        const params = [
            userId
        ];
        const currentBreak = await getRow(selectQuery, params)
        if(!currentBreak) {
            return null;
        }
        return currentBreak.break_id;
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function getPrimaryTeam() {
    const userPrimaryTeamUrl = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.USER_PRIMARY_TEAM
    const requestInfo = {
        method: "GET",
        url: userPrimaryTeamUrl,
        authType : 'bearertoken'
    }
    const response = await asyncApiRequest(requestInfo);
    if (response.data.data && response.data.data.team_id !== undefined) {
        return response.data.data.team_id;
    } else {
        return null;
    }
}

function decodeUTF8String(encodedTitle) {
    const hasEncodedChars = /\\\d{3}/.test(encodedTitle);

    if (!hasEncodedChars) {
        return encodedTitle;
    }
    return encodedTitle.replace(/\\([0-9]{3})/g, (match, octal) => {
        const byte = parseInt(octal, 8);
        return String.fromCharCode(byte);
    });
}

function decodeToUTF8(str) {
    const utf8Bytes = Array.from(str).map(char => char.charCodeAt(0));
    const decoder = new TextDecoder('utf-8');
    const decodedString = decoder.decode(new Uint8Array(utf8Bytes));
    return decodedString;
}

async function processTitle(encodedTitle) {
    const intermediateDecodedTitle = decodeUTF8String(encodedTitle);
    if (encodedTitle !== intermediateDecodedTitle) {
        return decodeToUTF8(intermediateDecodedTitle);
    }
    return encodedTitle;
}

async function getDateFromMicroseconds(microseconds) {
    let date = new Date(microseconds/1000);
    let options = {
            year: 'numeric', month: 'numeric', day: 'numeric',
        };
    return date.toLocaleDateString('en', options);
}

module.exports = {
  validateAccessToken,
  asyncApiRequest,
  setUserInfo,
  getUserInfo,
  clearUserInfo,
  setUserSettings,
  getUserSettings,
  intervalManager,
  startAutoSyncCurrentTask,
  getCurrentRunningTasks,
  getCurrentRunningTaskTrackingId,
  checkAndUpdateCurrentRunningTask,
  checkConnectivity,
  logInternetLostError,
  getUnfinishedTaskTrackingDetails,
  getTaskTrackedTime,
  insertUserIdleTimeData,
  stopAutoSyncCurrentTask,
  getCurrentWorkTimeLogId,
  getCurrentTimeInMicroseconds,
  getBaseURL,
  getCurrentRunningBreak,
  getPrimaryTeam,
  processTitle,
  getDateFromMicroseconds
};