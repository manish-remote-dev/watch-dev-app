// const isDev = process.env.NODE_ENV === 'development';
// let BASE_URL ={}
// if(isDev) {
//     BASE_URL = {
//         'ACCOUNT_API_BASE_URL' : 'https://dev-account.agile24.net/v1',
//         'WATCH_API_BASE_URL' : 'https://dev-watch.agile24.net/v1',
//         'TASK_API_BASE_URL' : 'https://dev-works.agile24.net/v1',
//         'HR_API_BASE_URL' : 'https://dev-hr.agile24.net/v1'
//     }
// } else {
//     BASE_URL = {
//         'ACCOUNT_API_BASE_URL' : 'https://api-account.cloudbi247.com/v1',
//         'WATCH_API_BASE_URL' : 'https://api-watch.cloudbi247.com/v1',
//         'TASK_API_BASE_URL' : 'https://api-works.cloudbi247.com/v1',
//         'HR_API_BASE_URL' : 'https://api-hr.cloudbi247.com/v1'
//     }
// }
let BASE_URL ={}
BASE_URL = {
    'ACCOUNT_API_BASE_URL' : 'https://dev-account.agile24.net/v1',
    'WATCH_API_BASE_URL' : 'https://dev-watch.agile24.net/v1',
    'TASK_API_BASE_URL' : 'https://dev-works.agile24.net/v1',
    'HR_API_BASE_URL' : 'https://dev-hr.agile24.net/v1'
}

const API_ENDPOINT = {
    'LOGIN': '/user/login',
    'USER_PROFILE': '/user/profile',
    'ATTENDANCE_STATUS' : '/hr/employee-attendance-status',
    'REGISTER_IN' : '/hr/employee-signin',
    'REGISTER_OUT' : '/hr/employee-signoff',
    'TASK_LIST' : '/work-management/scrum',
    'LOG_SCREEN_SHOT': '/log/screen-shot',
    'LOG_TASK_TRACKING': '/log/task-tracking',
    'LOG_INTERNET_CHECK' : '/log/internet-connectivity',
    'LOG_USER_IDLE_TIME': '/log/user-idle-time-tracking',
    'LOG_SCRUM_ENTRY': '/log/scrum-entry',
    'USER_SETTINGS' : '/setting/user',
    'WORK_ENTRY' : '/work-management/workentry',
    'SCRUM_ENTRY' : '/work-management/scrum',
    'TASK_STATUS' : '/work-management/task-status',
    'TASK' : '/work-management/tasks',
    'BREAK_SETTINGS' : '/setting/break',
    'LOG_BREAK_TRACKING' : '/log/break-tracking',
    'LOG_APP_URL' : '/log/app-url',
    'USER_PRIMARY_TEAM' : '/project/default-team',
    'BREAK_TIME' : '/report/break'
};

let KEYTAR_AUTH_DATA = {}

KEYTAR_AUTH_DATA = {
    'SERVICE': "accessToken_dev",
    'ACCOUNT': "BMS_WATCH_DEV",
};

// KEYTAR_AUTH_DATA = {
//     'SERVICE': "accessToken",
//     'ACCOUNT': "BMS_WATCH",
// };

const ERROR_MEG = {
    'WENT_WRONG_ERROR' :"Something went wrong. Please try again.",
    'INTERNAL_ERROR' :  'Internal Server Error. Please try again or contact support.',
    'ERR_TIMED_OUT'  : "Request time out. Please try again.",
    'net::ERR_INTERNET_DISCONNECTED' : "Internet Disconnected. Please check your connection.",
    'net::ERR_CONNECTION_REFUSED' : "Our main server is down. Please try again later or contact support.",
    'OFFLINE'  : "App is Offline",
    'NO_INTERNET' : "You do not have active internet connection.",
    'SLOW_INTERNET' : "You have poor internet connection.",
    'SLOW_INTERNET_MSG' : "You have slow internet connection, please check for better connectivity options.",
    'TASK_START_ERROR' : "Could not able to start task. Please stop your current running task and try again or contact support.",
    'TASK_STOP_ERROR' : "Could not able to stop task. Please try again or contact support.",
    'WORK_ENTRY_ERROR' : "Could not make work-entry. Please try in BMS Works portal.",
    'WORK_LOG_ENTRY_ERROR' : "Could not make work-log-time-entry.",
    'TASK_STATUS_CHANGE_ERROR' : "Could not able to change status of task.",
};

const WARNING_MSG = {
    'SURE_TO_DELETE_TASK': 'Are you sure to delete this task?',
    'STOP_CURRENT_TASK': 'A task is already running. Please stop it first.'
}

const USER_SETTINGS_CONSTANTS = {
    'screencast_interval' : 'screencast_interval',
    'timeout' : 'timeout',
    'no_tracking_reminder' : 'no_tracking_reminder',
    'web_and_app_tracking' : 'web_and_app_tracking'
}

const AUTO_SYNC_TIME = 60000;

const BREAK_REMINDER_COUNTER = 2;
const MAX_IDLE_TIME = 2 * 60 * 1000;
const REPEAT_REMINDER = 2*60*1000;
const NON_IDLE_THRESHOLD = 50

const BMS_EXTERNAL_LINKS = {
    'WEBSITE' : 'https://remoteprogrammer.com',
    'WORKS' : 'https://works.cloudbi247.com',
    'WATCH' : 'https://watch.cloudbi247.com',
};

const BMS_EXTERNAL_LINKS_END_POINTS = {
    'VIEW_TASK' : '/works/tasks/view'
};

const USER_TIMEZONE = "Asia/Kolkata";

const ACTIVITY_TIMEOUT_COUNTER = 60;

module.exports = {BASE_URL, API_ENDPOINT, KEYTAR_AUTH_DATA, ERROR_MEG, WARNING_MSG, USER_SETTINGS_CONSTANTS, AUTO_SYNC_TIME, BMS_EXTERNAL_LINKS, BMS_EXTERNAL_LINKS_END_POINTS, USER_TIMEZONE, ACTIVITY_TIMEOUT_COUNTER, BREAK_REMINDER_COUNTER, MAX_IDLE_TIME, REPEAT_REMINDER, NON_IDLE_THRESHOLD };