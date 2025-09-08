const { executeQuery, getRows, getRow } = require("../sqlitedb/sqlitedb");
const { intervalManager, getUserInfo, asyncApiRequest, processTitle, getDateFromMicroseconds } = require("./lib");
const { getURL, isBrowserWindow } = require('../browser/browser');
const { BASE_URL, API_ENDPOINT } = require("../config");
const { copyAllChromeHistory } = require("../browser/chrome");
const { copyAllEdgeHistory } = require("../browser/edge");
const { copyAllFirefoxHistory } = require("../browser/firefox"); 

async function startWebAndUrlTracking(userId, taskId) {
  intervalManager.startInterval(
    userId + "-webAndUrlTracking",
    () => trackWebAndUrl(userId, taskId),
    5000
  );
}

const trackWebAndUrl = async (userId, taskId) => {
  try {
    const baseUnixEpochInMilliseconds = new Date().getTime();
    const highResolutionTime = performance.now();
    const currentTimeInMicroseconds = Math.round(
      (baseUnixEpochInMilliseconds * 1000) + (highResolutionTime % 1) * 1000
    );
    const getWindows = await import("get-windows-rp-ms");
    const window = await getWindows.activeWindow({
      accessibilityPermission: true,
    });

    let title = 'Could Not Determine';
    let type = 'app';
    let path = 'undefined';
    let name = 'undefined';
    let platform = 'undefined';

    if (window) {
      title = window.title;
      if (title.startsWith('"') && title.endsWith('"')) {
        title = title.slice(1, title.length - 1);
      }
      title = await processTitle(title);

      if (title && title.includes("●")) {
        title = title.replace("●", "").trim();
      }
      // if title starts with 'Microsoft Teams' then set type as 'app' and name as 'Microsoft Teams'
      if (title.startsWith("Microsoft Teams")) {
        type = 'app';
        name = "Microsoft Teams";
      } else {
        const is_browser = await isBrowserWindow(window.owner.name.toLowerCase());
        type = is_browser ? 'website' : 'app';
        name = window.owner.name;
      }
      path = window.owner.path;
      platform = window.platform;
    }

    const sqlQuery = `INSERT INTO web_and_url_tracking (
                          user_id, task_id, logged_at, type, title, path, name, platform)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const sqlParams = [
      userId,
      taskId,
      currentTimeInMicroseconds,
      type,
      title,
      path,
      name,
      platform
    ];
    await executeQuery(sqlQuery, sqlParams);
  } catch (error) {
    console.log(error);
  }
};

async function stopWebAndUrlTracking() {
  const userInfo = await getUserInfo();
  intervalManager.stopInterval(userInfo.user.user_id + "-webAndUrlTracking");
}

const processWebUrlTrackingSummary = async () => {
  const selectQuery = `
      WITH initial_rows AS (
          SELECT *
          FROM web_and_url_tracking
          WHERE is_processed = 0
          ORDER BY logged_at
          LIMIT 36
      ),
      numbered_rows AS (
          SELECT *,
              ROW_NUMBER() OVER (ORDER BY logged_at) -
              ROW_NUMBER() OVER (PARTITION BY user_id, task_id, title, type, name, date(logged_at / 1000000, 'unixepoch') ORDER BY logged_at) AS group_num
          FROM initial_rows
      ),
      grouped_rows AS (
          SELECT user_id,
              task_id,
              title,
              type,
              name,
              path,
              platform,
              MIN(logged_at) AS start_time,
              MAX(logged_at) + 5000000 AS end_time,
              ((MAX(logged_at) + 5000000) - MIN(logged_at)) / 1000000 AS duration_seconds,
              GROUP_CONCAT(id) AS ids
          FROM numbered_rows
          GROUP BY user_id, task_id, title, type, group_num
      )
      SELECT user_id, task_id, title, type, name, path, platform, start_time, end_time, duration_seconds, ids
      FROM grouped_rows
      ORDER BY start_time;
    `;

    try {
        const lastRowQuery = `
          SELECT *
          FROM web_and_url_tracking_summary
          WHERE is_synced = 0
          ORDER BY id DESC
          LIMIT 1;
        `;
        const lastRow = await getRow(lastRowQuery);

        const rows = await getRows(selectQuery);
        const idsToUpdate = rows.flatMap((row) => row.ids.split(",").map(Number));

        if (lastRow && rows.length > 0) {
            const firstRow = rows[0];
            // Extract and compare dates
            const firstRowDate = await getDateFromMicroseconds(firstRow.start_time);
            const lastRowDate = await getDateFromMicroseconds(lastRow.end_time);
            const hasSameDate = firstRowDate === lastRowDate;
            if (
                lastRow.user_id == firstRow.user_id &&
                // lastRow.team_id == firstRow.team_id &&
                lastRow.task_id == firstRow.task_id &&
                lastRow.title == firstRow.title &&
                lastRow.type == firstRow.type &&
                lastRow.name == firstRow.name &&
                hasSameDate
            ) {
                const mergedStartTime = lastRow.start_time;
                const mergedEndTime = firstRow.end_time;
                const mergedDuration = lastRow.duration_seconds + firstRow.duration_seconds;

                const updateLastRowQuery = `
                        UPDATE web_and_url_tracking_summary
                        SET start_time = ?, end_time = ?, duration_seconds = ?
                        WHERE id = ?
                    `;
                const updateParams = [
                    mergedStartTime,
                    mergedEndTime,
                    mergedDuration,
                    lastRow.id
                ];
                await executeQuery(updateLastRowQuery, updateParams);
                // Remove the first row from the current batch as it's merged
                rows.shift();
            }
        }

        for (const row of rows) {
          let is_processed = (row.type === 'app') ? 1 : 0;
          const insertQuery = 
                `INSERT INTO web_and_url_tracking_summary (
                    user_id,
                    task_id,
                    title,
                    type,
                    name,
                    path,
                    platform,
                    start_time,
                    end_time,
                    duration_seconds,
                    is_processed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

          const params = [
            row.user_id,
            row.task_id,
            row.title,
            row.type,
            row.name,
            row.path,
            row.platform,
            row.start_time,
            row.end_time,
            row.duration_seconds,
            is_processed,
          ];
          await executeQuery(insertQuery, params);
        }
    
        // delete the original processd rows
        const updateQuery = 
            `DELETE FROM web_and_url_tracking
            WHERE id IN (${idsToUpdate.join(",")})`;

        // const updateQuery = 
        //     `UPDATE web_and_url_tracking SET is_processed = 1 
        //     WHERE id IN (${idsToUpdate.join(",")})`;

        await executeQuery(updateQuery);
      } catch (error) {
        console.error("Error inserting data or updating rows:", error);
      }
};

const updateURLofTrackedWebsite = async () => {
  try {
    // Check and copy browser history files for different browsers
    const distinctBrowserNamesQuery = `
      SELECT DISTINCT name
      FROM web_and_url_tracking_summary
      WHERE is_processed = 0 AND type = 'website'
    `;

    const supportedBrowsers = {
      'google-chrome': copyAllChromeHistory,
      'google chrome': copyAllChromeHistory,
      'firefox': copyAllFirefoxHistory,
      'firefox_firefox': copyAllFirefoxHistory,
      'firefox firefox': copyAllFirefoxHistory,
      'microsoft-edge': copyAllEdgeHistory,
      'microsoft edge': copyAllEdgeHistory,
    };

    const distinctNames = await getRows(distinctBrowserNamesQuery);
    distinctNames.forEach((row) => {
      row.name = row.name.toLowerCase();
    });

    for (const { name } of distinctNames) {
      if (supportedBrowsers[name]) {
        // console.log(`copying history for ${name}...`);
        await supportedBrowsers[name]();
      } else {
        console.log(`Unsupported browser name: ${name}. Skipping.`);
      }
    }

    // Select rows for processing
    const selectQuery = `
      SELECT *
      FROM web_and_url_tracking_summary
      WHERE is_processed = 0 AND type = 'website'
      ORDER BY id
      LIMIT 36
    `;
    const rows = await getRows(selectQuery);

    if (!rows || rows.length === 0) {
      return;
    }

    for (const row of rows) {
      try {
        const response = await getURL(row.title, row.name);
        const updateQuery = `
          UPDATE web_and_url_tracking_summary
          SET formatted_title = ?, url = ?, base_url = ?, is_newtab = ?, is_private = ?, is_processed = ?
          WHERE id = ?
        `;
        const updateParams = [
          response.formatted_title,
          response.url,
          response.base_url,
          response.is_newtab,
          response.is_private,
          1,
          row.id
        ];
        await executeQuery(updateQuery, updateParams);
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

const syncWebAndAppWithCloud = async () => {
  const userInfo = await getUserInfo();
  let userName = userInfo.user.first_name + ' ' +userInfo.user.last_name;
  let teamId = userInfo.team_id;
  const url = BASE_URL.WATCH_API_BASE_URL + API_ENDPOINT.LOG_APP_URL;
  const selectQuery = `
      SELECT *
      FROM web_and_url_tracking_summary
      WHERE is_processed = 1 AND is_synced = 0
      ORDER BY id
      LIMIT 36
    `;
  const rows = await getRows(selectQuery);
  for (const row of rows) {
    const { is_processed, is_synced, ...filteredRow } = row;
    filteredRow.user_name = userName;
    filteredRow.team_id = teamId;
    const payload = filteredRow;
    const requestInfo = {
      method: "POST",
      url: url,
      authType: 'bearertoken',
      requestData: payload
    }
    const result = await asyncApiRequest(requestInfo);
    if (result.data.data) {
      const updateQuery = `
        DELETE FROM web_and_url_tracking_summary
        WHERE id = ?
      `;
      const updateParams = [
        result.data.data.successID
      ];
      await executeQuery(updateQuery, updateParams);
    }
    if (result.data.errors) {
      console.log(result.data.errors)
    }
  }
}

module.exports = {
  startWebAndUrlTracking,
  stopWebAndUrlTracking,
  processWebUrlTrackingSummary,
  updateURLofTrackedWebsite,
  syncWebAndAppWithCloud
};
