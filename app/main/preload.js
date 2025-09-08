const { contextBridge, ipcRenderer } = require('electron')
const config = require('./config')
const { getTodaysTotalTaskTimeUserWise } = require('./js/taskWorkTimeLog')

contextBridge.exposeInMainWorld('config', config)

contextBridge.exposeInMainWorld('WatchAPI', {
    openExternal: (url) => ipcRenderer.send('open-external', url),
    makeAsyncApiRequest: async (requestInfo) => {
        return await ipcRenderer.invoke('make-async-api-request', requestInfo)
    },
    loginSuccess: async (accessToken) => {
        return await ipcRenderer.invoke('login-success', accessToken)
    },
    getUserInfo: async () => {
        return await ipcRenderer.invoke('get-user-info')
    },
    getUserSettings: async () => {
        return await ipcRenderer.invoke('get-user-settings')
    },
    logout: () => ipcRenderer.send('logout'),
    currentRunningTask: async () => {
        return await ipcRenderer.invoke('current-running-task')
    },
    scrumEntry: async (scrumTaskDetails) => {
        return await ipcRenderer.invoke('scrum-entry', scrumTaskDetails)
    },
    deleteScrumEntry: async (scrumEntryId) => {
        return await ipcRenderer.invoke('delete-scrum-entry', scrumEntryId)
    },
    getRowFromLocalDB: async (query, params=[]) => {
        return await ipcRenderer.invoke('get-row-from-local-db', query, params)
    },
    startTask: async (taskId, taskTitle, projectId, projectName, mode, team_id, team_name) => {
        return await ipcRenderer.invoke('start-task', taskId, taskTitle, projectId, projectName, mode, team_id, team_name)
    },
    stopTask: async (trackingId) => {
        return await ipcRenderer.invoke('stop-task', trackingId)
    },
    idleDetection: async () => {
        return await ipcRenderer.invoke('idle-detection')
    },
    activeDetection: async () => {
        return await ipcRenderer.invoke('active-detection')
    },
    userWorkingResponse: async (workingStatus) => {
        return await ipcRenderer.invoke('user-working-response', workingStatus);
    },
    onUserIdle: (callback) => ipcRenderer.on('user-idle-channel', (event, data) => callback(data)),

    userNoTrackingReminder: (callback) => ipcRenderer.on('user-no-tracking-reminder', (event, data) => callback(data)),
    /*getBreaks: async (options = {}) => {
        return await ipcRenderer.invoke('get-breaks', options);
    },*/

    checkInternetConnectivity: () => ipcRenderer.invoke('checkInternetConnectivity'),
    logNetStatusChange: (status) => ipcRenderer.invoke('logNetStatusChangeData',status),
    unfinishedTaskTrackingDetails: async (taskId) => {
        return await ipcRenderer.invoke('unfinished-task-tracking-details', taskId)
    },
    getTaskTrackedTime: async (trackingId) => {
        return await ipcRenderer.invoke('get-task-tracked-time', trackingId)
    },
    noInternet: () => ipcRenderer.send('no-internet'),
    getEachTaskWorkLogInfo: async(taskId) => {
        return await ipcRenderer.invoke('get-task-work-log', taskId);
    },
    getTodaysTotalTaskTimeUserWise: async(userId) => {
        return await ipcRenderer.invoke('get-todays-total-task-time', userId);
    },
    getTodaysTotalBreakTimeUserWise: async(userId) => {
        return await ipcRenderer.invoke('get-todays-total-break-time', userId);
    },
    onRefreshTrigger: (callback) => ipcRenderer.on('refresh-button-click', () => callback()),
    getBreaks: async (options = {}) => ipcRenderer.invoke('get-breaks', options),
    startBreak: async (breakId) => ipcRenderer.invoke('start-break', breakId),
    stopBreak: async (breakId) => ipcRenderer.invoke('stop-break', breakId),
    currentRunningBreak: async () => ipcRenderer.invoke('current-running-break'),
    currentRunningTaskTrackingId: async () => {
        return await ipcRenderer.invoke('current-running-task-tracking-id')
    },
    updatePrimaryTeam: async () => {
        return await ipcRenderer.invoke('update-primary-team')
    },

    stopCurrentRunningTaskInBackground: async () => {
        return await ipcRenderer.invoke('stop-current-running-task-in-background')
    },
    updateWorkEntryStatus: async (taskTrackingId, workEntryMessage) => {
        ipcRenderer.invoke('update-work-entry-status', taskTrackingId, workEntryMessage);
    },
    closeReminderBreak: () => ipcRenderer.send('close-reminder-break-modal'),
})
