const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

const chromeDataDir = path.join(os.homedir(), 'watch-app', 'data', 'chrome');

if (!fs.existsSync(chromeDataDir)) {
    fs.mkdirSync(chromeDataDir, { recursive: true });
}

function getChromeProfilePath() {
    const userHomeDir = os.homedir();
    if (process.platform === 'win32') {
        return path.join(userHomeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    } else if (process.platform === 'darwin') {
        return path.join(userHomeDir, 'Library', 'Application Support', 'Google', 'Chrome');
    } else if (process.platform === 'linux') {
        return path.join(userHomeDir, '.config', 'google-chrome');
    }
    throw new Error('macOS, Linux, and Windows only');
}

async function getAllChromeHistoryPaths() {
    const chromeBasePath = getChromeProfilePath();

    if (!fs.existsSync(chromeBasePath)) {
        return null;
    }

    const historyFiles = fs.readdirSync(chromeBasePath)
        .filter(dir => dir === 'Default' || dir.startsWith('Profile'))
        .map(dir => ({
            source: path.join(chromeBasePath, dir, 'History'),
            destination: path.join(chromeDataDir, dir)
        }))
        .filter(paths => fs.existsSync(paths.source));

    if (historyFiles.length === 0) {
        return null;
    }

    return historyFiles;
}

async function copyAllChromeHistory() {
    try {
        const historyFiles = await getAllChromeHistoryPaths();
        if (!historyFiles) {
            console.error('No Chrome History files found');
            return false;
        }
        historyFiles.forEach(({ source, destination }) => {
            if (!fs.existsSync(destination)) {
                fs.mkdirSync(destination, { recursive: true });
            }
            const fileName = path.basename(source);
            const destPath = path.join(destination, fileName);
            fs.copyFileSync(source, destPath);
            // console.log(`Copied: ${source} -> ${destPath}`);
        });
    } catch (error) {
        console.log('copy chrome histry file eror : ', error)
    }
}


// fetch url using title
async function fetchWindowDetailsByTitle(title) {
    try {
      const allHistoryPath = await getAllChromeHistoryPaths();
      if (!allHistoryPath || allHistoryPath.length === 0) {
        console.log('No Chrome history files available for processing.');
        return { url: null };
      }
      for (const { source, destination } of allHistoryPath) {
        try {
          const dbPath = path.join(destination, 'History');
          const result = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) {
                console.error(`Error opening database at ${dbPath}:`, err);
                reject(err);
              }
            });
            const query = `
              SELECT 
                  url
              FROM urls
              WHERE title = ?
              ORDER BY last_visit_time DESC
              LIMIT 1;
            `;
            db.get(query, [title], (err, row) => {
              if (err) {
                // console.error(`Error executing query on ${dbPath}:`, err);
                db.close();
                reject(err);
              } else if (row) {
                // console.log(`Query result for title '${title}' in ${dbPath}:`, row);
                db.close();
                resolve({
                  url: row.url,
                });
              } else {
                // console.log(`No results found for title '${title}' in ${dbPath}`);
                db.close();
                resolve(null);
              }
            });
          });
          if (result) {
            return result;
          }
        } catch (error) {
          console.log(error);
        }
      }
      return { url: null };
    } catch (error) {
      // console.error('Error in fetchWindowDetailsByTitle:', error);
      return { url: null };
    }
}

module.exports = {
    fetchWindowDetailsByTitle,
    copyAllChromeHistory
}