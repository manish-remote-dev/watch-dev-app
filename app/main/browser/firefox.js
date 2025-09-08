const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

const firefoxDataDir = path.join(os.homedir(), 'watch-app', 'data', 'firefox');

if (!fs.existsSync(firefoxDataDir)) {
    fs.mkdirSync(firefoxDataDir, { recursive: true });
}

function getFirefoxProfilePath() {
    const userHomeDir = os.homedir();
    if (process.platform === 'win32') {
        return path.join(userHomeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox');
    } else if (process.platform === 'darwin') {
        return path.join(userHomeDir, 'Library', 'Application Support', 'Firefox');
    } else if (process.platform === 'linux') {
        const snapPath = path.join(userHomeDir, 'snap', 'firefox', 'common', '.mozilla', 'firefox');
        return fs.existsSync(snapPath) ? snapPath : path.join(userHomeDir, '.mozilla', 'firefox');
    }

    throw new Error('macOS, Linux, and Windows only');
}

async function getAllFirefoxHistoryPaths() {
    const firefoxBasePath = getFirefoxProfilePath();
    const profilesIniPath = path.join(firefoxBasePath, 'profiles.ini');

    if (!fs.existsSync(profilesIniPath)) {
        return null;
    }

    // Read and parse profiles.ini file
    const profilesIniContent = fs.readFileSync(profilesIniPath, 'utf-8');
    const profiles = profilesIniContent.split(/\r?\n/).reduce((acc, line) => {
        const match = line.match(/Path=(.*)/);
        if (match) {
            const profilePath = match[1].trim();
            const fullPath = profilePath.startsWith('/')
                ? profilePath // Absolute path
                : path.join(firefoxBasePath, profilePath); // Relative path

            const dbPath = path.join(fullPath, 'places.sqlite');
            if (fs.existsSync(dbPath)) {
                acc.push({
                    source: dbPath,
                    destination: path.join(firefoxDataDir, path.basename(profilePath))
                });
            }
        }
        return acc;
    }, []);

    return profiles.length > 0 ? profiles : null;
}

async function copyAllFirefoxHistory() {
    try {
        const historyFiles = await getAllFirefoxHistoryPaths();
        if (!historyFiles) {
            console.error('No Firefox places.sqlite files found');
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
        console.log('Error copying Firefox places.sqlite files:', error);
    }
}

// fetch url using title
async function fetchWindowDetailsByTitle(title) {
    try {
      const allHistoryPath = await getAllFirefoxHistoryPaths();
      if (!allHistoryPath || allHistoryPath.length === 0) {
        // console.log('No Firefox history files available for processing.');
        return { url: null };
      }
      for (const { source, destination } of allHistoryPath) {
        try {
          const dbPath = path.join(destination, 'places.sqlite');
          const result = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) {
                // console.error(`Error opening database at ${dbPath}:`, err);
                reject(err);
              }
            });
            const query = `
              SELECT 
                  url
              FROM moz_places
              WHERE title = ?
              ORDER BY last_visit_date DESC
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
    //   console.error('Error in fetchWindowDetailsByTitle:', error);
      return { url: null };
    }
}

module.exports = {
    copyAllFirefoxHistory,
    fetchWindowDetailsByTitle
}