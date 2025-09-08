const { app, BrowserWindow, ipcMain, net, screen, shell, Tray, Menu } = require('electron/main');
const path = require('node:path');
const keytar = require('keytar');
const fs = require('fs');
const storage = require('electron-json-storage');
const { KEYTAR_AUTH_DATA } = require('./config');
const { validateAccessToken, setUserSettings, intervalManager, getUserInfo, checkAndUpdateCurrentRunningTask, checkConnectivity, getPrimaryTeam } = require('./js/lib');
const { createDefaultTable } = require('./sqlitedb/sqlitedb');
const { captureScreenShot, syncScreenShotToMongo } = require('./js/screenshot');
const { taskTrackingHandlers } = require('./ipc/taskTrackingHandlers');
require('./ipc/ipcHandlers');
require('./ipc/scrumHandlers')
require('./ipc/idleTrackingHandlers');
require('./ipc/taskWorkTimeLogHandler');
require('./ipc/breakHandlers');
const cron = require('node-cron');
const { syncTaskTrackingToMongoDB } = require('./js/taskTracking');
const { syncLostInternetConnectivityToMongoDB } = require('./js/internetConnectivity');
const { noTrackingReminderStart } = require('./js/noTrackingReminder');
const { syncUserIdleTimeToMongoDB, checkAndUpdateUserIdleTime } = require('./js/userIdleTimeTracking');
const { syncScrumEntryToMongoDB, deleteOldScrumEntries } = require('./js/scrumEntry');
const { deleteOldWorkLogEntries, checkAndUpdateCurrentRunningWorkLogEntry } = require('./js/taskWorkTimeLog');

const {processWebUrlTrackingSummary, updateURLofTrackedWebsite, syncWebAndAppWithCloud} = require('./js/webAndUrlTracking')
const sqlite3 = require('sqlite3').verbose();

const packageConfig = require('./../../package.json');
const { checkAndUpdateCurrentRunningBreak, syncBreakTrackingToMongoDB } = require('./js/break');
const { breakTrackingHandlers } = require('./ipc/breakHandlers');

// const isDev = process.env.NODE_ENV === 'development';
// const appName = isDev ? packageConfig.config.devName : packageConfig.config.prodName;
const appName = "BMS Watch Dev";

// Single-instance lock to prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            mainWindow.show();
        }
    });

    // set custom storage path for electron-json-storage
    let customStoragePath = '';
    // if(isDev) {
    //     customStoragePath = path.join(app.getAppPath(), 'watch_custom_storage');
    // } else {
    //     customStoragePath = path.join(app.getPath('userData'), 'watch_custom_storage');
    // }
    customStoragePath = path.join(app.getPath('userData'), 'watch_custom_storage');
    if (!fs.existsSync(customStoragePath)) {
        fs.mkdirSync(customStoragePath, { recursive: true });
    }
    storage.setDataPath(customStoragePath);

    async function loadPage(filePath) {
        mainWindow.loadFile(path.join(app.getAppPath(), filePath));
    }

    let mainWindow;

    async function handleAccessToken(storedAccessToken) {
        try {
            const validatedAccessToken = await validateAccessToken(storedAccessToken);
            if (validatedAccessToken) {
                ipcMain.emit('redirect-dashboard');
            } else {
                ipcMain.emit('logout');
            }
        } catch (error) {
            throw error;
        }
    }

    async function createWindow() {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const windowWidth = Math.floor(width * 0.8); // 80% of the display width
        const windowHeight = Math.floor(height * 0.8); // 80% of the display height
        mainWindow = new BrowserWindow({
            width: windowWidth,
            height: windowHeight,
            title: appName,
            webPreferences: {
                // nodeIntegration: false, // Disable Node.js in renderer
                // contextIsolation: true, // Enable isolation
                preload: path.join(app.getAppPath(), 'app/main/preload.js'),
                sandbox: false,
                // spellcheck: isDev,
                // devTools: isDev,
            }
        })

        // mainWindow.setMenu(null);

        ipcMain.on('redirect-dashboard', async () => {
            try {
                await setUserSettings();
                await checkAndUpdateCurrentRunningTask(); //If App closed before stop the current task
                await checkAndUpdateUserIdleTime(); //If App closed before choosing he was 'working' or 'not working' at the idle time
                await checkAndUpdateCurrentRunningBreak();
                await noTrackingReminderStart(mainWindow);
                await deleteOldScrumEntries();
                await deleteOldWorkLogEntries();
                await checkAndUpdateCurrentRunningWorkLogEntry();
                ipcMain.emit('run-cron-schedule');

                await loadPage('app/renderer/pages/dashboard.html');
            } catch (error) {
                ipcMain.emit('logout');
            }
        });

        ipcMain.on('redirect-login', async () => {
            try {
                // mainWindow.loadFile(path.join(app.getAppPath(), 'app/renderer/pages/login.html'));
                await loadPage('app/renderer/pages/login.html');
            } catch (error) {
                throw error;
            }
        });

        ipcMain.on('refresh-dashboard', async () => {
            try {
                mainWindow.webContents.send('refresh-button-click');
            } catch (error) {
                throw error;
            }
        });

        ipcMain.on('run-cron-schedule', async () => {
            try {
                    const userInfo = await getUserInfo();
                    const userId = userInfo.user.user_id;
                    cron.schedule('*/2 * * * *', async() => {
                        const isConnected = await checkConnectivity();
                        if (isConnected) {
                            syncTaskTrackingToMongoDB(userId);
                            syncBreakTrackingToMongoDB(userId);
                            syncUserIdleTimeToMongoDB(userId);
                            syncScreenShotToMongo();
                            syncLostInternetConnectivityToMongoDB();
                            syncScrumEntryToMongoDB(userId);
                        }
                    });

                    cron.schedule('*/2 * * * *', async() => {
                        const isConnected = await checkConnectivity();
                        if (isConnected) {
                            processWebUrlTrackingSummary();
                        }
                    });

                    cron.schedule('*/3 * * * *', async() => {
                        const isConnected = await checkConnectivity();
                        if (isConnected) {
                            updateURLofTrackedWebsite();
                        }
                    });

                    cron.schedule('*/4 * * * *', async() => {
                        const isConnected = await checkConnectivity();
                        if (isConnected) {
                            syncWebAndAppWithCloud();
                        }
                    });

            } catch (error) {
                console.error('Error during run-cron-schedule:', error);
            }
        });

        mainWindow.on('focus', () => {
            mainWindow.webContents.send('refresh-button-click');
        });

        // varify access token and load html page accordingly
        const storedAccessToken = await keytar.getPassword(KEYTAR_AUTH_DATA.SERVICE, KEYTAR_AUTH_DATA.ACCOUNT);
        if( net.isOnline() ) {
            if (storedAccessToken) {
                    await handleAccessToken(storedAccessToken);
            } else {
                await loadPage('app/renderer/pages/login.html');
            }
        } else {
            await loadPage('app/renderer/pages/noInternet.html');
        }

        taskTrackingHandlers(mainWindow);// Initialize taskTrackingHandlers only
        breakTrackingHandlers(mainWindow);

        mainWindow.on('close', (event) => {
            if (!app.isQuiting) {
                event.preventDefault();
                mainWindow.hide();  // Minimize the window to the tray
            }
        });
    }

    app.whenReady().then( async () => {
        try {
            await createDefaultTable();
            createWindow()
            createTray();
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    createWindow()
                }
            })
        } catch (error) {
            // console.log(error);
        }
    })

    app.on('window-all-closed', async() => {
        await intervalManager.clearAllIntervals();
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })

    /*ipcMain.on('reset-inactivity-timer', () => {
        //console.log('Inactivity timer reset');
        idleTrackingStart(mainWindow);
    }); DONT REMOVE PS*/
    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });

    let tray = null;
    function createTray() {
        tray = new Tray(path.join(app.getAppPath(), 'app/renderer/assets/img/tray.png'));

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open App',
                click: () => {
                    mainWindow.show();
                }
            },
            {
                label: 'Quit',
                click: quitApp
            }
        ]);

        tray.setContextMenu(contextMenu);
        tray.setToolTip('BMS Watch');

        tray.on('click', () => {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        });
    }

    app.on('before-quit', () => {
        if (tray) tray.destroy();
    });

    function quitApp() {
        app.isQuiting = true;
        app.quit();
    }

    // Listen for Ctrl+C in the terminal
    process.on('SIGINT', () => {
        console.log("SIGINT received: closing application.");
        app.isQuiting = true; // Set flag to true to allow quitting
        app.quit(); // Quit the app
    });
}