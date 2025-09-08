const { app } = require('electron/main');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const initializeDatabase = async () => {
    // const isDev = process.env.NODE_ENV === 'development';
    let dbPath = '';
    // if(isDev) {
    //     dbPath = path.join(app.getAppPath(), 'watchApp.db');
    // } else {
    //     dbPath = path.join(app.getPath('userData'), 'watchApp.db');
    // }
    dbPath = path.join(app.getPath('userData'), 'watchApp.db');
    const db = new sqlite3.Database(dbPath);
    return db;
};

const createDefaultTable = async () => {
    try {
        db = await initializeDatabase();
        await runQuery(db, `
                    CREATE TABLE IF NOT EXISTS watch_error_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    error_location TEXT NOT NULL,
                    error_message TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
            `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS scrum_entry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    worked_date TEXT NOT NULL,
                    project_id INTEGER NOT NULL,
                    project_name TEXT NOT NULL,
                    task_id INTEGER NOT NULL,
                    scrum_message TEXT,
                    expected_spent_time TEXT,
                    is_synced INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(task_id, worked_date)
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS task_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER,
                    task_title TEXT,
                    project_id INTEGER,
                    project_name TEXT,
                    user_id INTEGER,
                    user_name TEXT,
                    system_auto_sync_at TEXT,
                    work_entry_status INTEGER NOT NULL DEFAULT 0,
                    work_entry_message TEXT,
                    partial_sync_with_mongo INTEGER NOT NULL DEFAULT 0,
                    final_sync_with_mongo INTEGER NOT NULL DEFAULT 0,
                    is_finished INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
        `)

        await runQuery(db, `
                CREATE TRIGGER IF NOT EXISTS enforce_single_running_task_per_user_insert
                BEFORE INSERT ON task_tracking
                FOR EACH ROW
                WHEN NEW.is_finished = 0
                BEGIN
                    -- Check if there is any other row with is_finished = 0 for the same user
                    SELECT CASE
                        WHEN (SELECT COUNT(*) FROM task_tracking WHERE is_finished = 0 AND user_id = NEW.user_id) > 0
                        THEN RAISE(ABORT, 'This user already has a running task.')
                    END;
                END;
        `)

        await runQuery(db, `
                CREATE TRIGGER IF NOT EXISTS enforce_single_running_task_per_user_update
                BEFORE UPDATE ON task_tracking
                FOR EACH ROW
                WHEN NEW.is_finished = 0
                BEGIN
                    -- Check if there is any other row with is_finished = 0 for the same user, excluding the current row
                    SELECT CASE
                        WHEN (SELECT COUNT(*) FROM task_tracking WHERE is_finished = 0 AND user_id = NEW.user_id AND id != NEW.id) > 0
                        THEN RAISE(ABORT, 'This user already has a running task.')
                    END;
                END;
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS "task_time_segment" (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_tracking_id INTEGER,
                    start_at TEXT,
                    end_at TEXT,
                    mode TEXT
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS "user_idle_time" (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    task_id INTEGER,
                    task_tracking_id INTEGER,
                    start_at TEXT,
                    end_at TEXT,
                    system_auto_sync_at TEXT,
                    status TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS screenshot_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    screen_base64 TEXT NOT NULL,
                    is_synced INTEGER NOT NULL DEFAULT 0,
                    captured_at TEXT NOT NULL
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS internet_connectivity_lost_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    user_name TEXT,
                    system_auto_sync_at TEXT,
                    start_at TEXT NOT NULL,
                    end_at TEXT NULL
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS task_work_time_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER,
                    user_id INTEGER,
                    start_at TEXT,
                    end_at TEXT,
                    system_auto_sync_at TEXT
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS web_and_url_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    task_id INTEGER,
                    logged_at INTEGER NOT NULL,
                    type TEXT,
                    title TEXT,
                    path TEXT,
                    name TEXT,
                    platform TEXT,
                    is_processed INTEGER NOT NULL DEFAULT 0
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS web_and_url_tracking_summary (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    task_id INTEGER,
                    title TEXT,
                    formatted_title TEXT,
                    type TEXT,
                    name TEXT,
                    path TEXT,
                    platform TEXT,
                    url TEXT,
                    base_url TEXT,
                    start_time INTEGER NOT NULL,
                    end_time INTEGER NOT NULL,
                    duration_seconds INTEGER,
                    is_private INTEGER NOT NULL DEFAULT 0,
                    is_newtab INTEGER NOT NULL DEFAULT 0,
                    is_processed INTEGER NOT NULL DEFAULT 0,
                    is_synced INTEGER NOT NULL DEFAULT 0
                )
        `)

        await runQuery(db, `
                CREATE TABLE IF NOT EXISTS break_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    break_id INTEGER,
                    user_id INTEGER,
                    user_name TEXT,
                    start_at TEXT,
                    end_at TEXT,
                    system_auto_sync_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
        `)

        // Alter table scrum_entry, add colum team_id and team_name
        const columns = await getTableColumns(db, "scrum_entry");
        const columnNames = columns.map(col => col.name);
        if (!columnNames.includes('team_id')) {
            db.run(`
                ALTER TABLE scrum_entry ADD COLUMN team_id INTEGER DEFAULT NULL;
            `);
        }
        if (!columnNames.includes('team_name')) {
            db.run(`
                ALTER TABLE scrum_entry ADD COLUMN team_name TEXT DEFAULT NULL;
            `);
        }

        // Alter table task_tracking, add column team_id and team_name
        const taskTrackingColumns = await getTableColumns(db, "task_tracking");
        const taskTrackingColumnNames = taskTrackingColumns.map(col => col.name);
        if (!taskTrackingColumnNames.includes('team_id')) {
            db.run(`
                ALTER TABLE task_tracking ADD COLUMN team_id INTEGER DEFAULT NULL;
            `);
        }
        if (!taskTrackingColumnNames.includes('team_name')) {
            db.run(`
                ALTER TABLE task_tracking ADD COLUMN team_name TEXT DEFAULT NULL;
            `);
        }

        db.close();
    } catch (error) {
        throw error;
    }

}

function runQuery(db, query) {
    return new Promise((resolve, reject) => {
        db.run(query, function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

const getTableColumns = (db, tableName) => {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName});`, (err, columns) => {
            if (err) return reject(err);
            resolve(columns);
        });
    });
};

const getRow = async (query, params = []) => {
    try {
        db = await initializeDatabase();
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row? row : null);
                }
            });
        });
    } catch (error) {
        throw error;
    } finally {
        db.close();
    }
}

const getRows = async (query, params = []) => {
    try {
        db = await initializeDatabase();
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows ? rows : null);
                }
            });
        });
    } catch (error) {
        throw error;
    } finally {
        db.close();
    }
}

const executeQuery = async (query, params = []) => {
    let db;
    try {
        db = await initializeDatabase();
        return new Promise((resolve, reject) => {
            db.run(query, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    // Determine the type of SQL operation
                    const operation = query.trim().split(' ')[0].toUpperCase();

                    switch (operation) {
                        case 'INSERT':
                            if( this.lastID === 0 && this.changes !== 0) {
                                resolve({'changes' : this.changes})
                            } else {
                                resolve({'lastId':this.lastID});
                            }
                            break;
                        case 'UPDATE':
                            resolve({'changes' : this.changes})
                            break;
                        case 'DELETE':
                            resolve({'changes' : this.changes})
                            break;
                        default:
                            resolve(null);
                            break;
                    }
                }
            });
        });
    } catch (error) {
        throw error;
    } finally {
        if (db) {
            db.close();
        }
    }
}

module.exports = { 
    initializeDatabase,
    createDefaultTable,
    getRow,
    getRows,
    executeQuery
};