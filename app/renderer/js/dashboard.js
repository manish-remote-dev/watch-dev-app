document.getElementById("signOut").addEventListener("click", async (e) => await signOut(e));

async function signOut() {
    await window.WatchAPI.logout();
}

/**
 * check and update current running task for unexpected shutdown
 */

/**
 * display userinfo in navigation drawer
 */
document.addEventListener("DOMContentLoaded", async () => {
    const userInfo = await window.WatchAPI.getUserInfo();
    const fullName = `${userInfo.user.first_name} ${userInfo.user.last_name}`;

    const usernameSmallElement = document.getElementById('username-small');
    const usernameElement = document.getElementById('username');

    if (usernameSmallElement) {
        usernameSmallElement.innerText = fullName;
    }
    if (usernameElement) {
        usernameElement.innerText = fullName;
    }
});

/**
 * check for employee attendance status
 * display/hide register-in out button
 * display in-time, out-time
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const attendanceStatus = await checkAttendanceStatus()
        if( attendanceStatus && attendanceStatus.data.data ) {
            const logInTime = attendanceStatus.data.data.login_time;
            const convertedLoginTime = await convertUTCTimeToTimezone(logInTime.date)

            showHideButton("register-in", "hide");
            showHideButton("register-out", "show");
            displayTime("in-time",convertedLoginTime);
            showHideButton("register-in-out-placeholder", "hide")

            const logOutTime = attendanceStatus.data.data.logout_time;
            const convertedLogoutTime = await convertUTCTimeToTimezone(logOutTime.date)
            if(convertedLogoutTime) {
                displayTime("out-time",convertedLogoutTime);
            }
        }
        if( attendanceStatus && attendanceStatus.data.errors )
        {
            error = await formatBMSAPIError(attendanceStatus.data)
            if(error.errors.message.includes('No Record Found in todays register') )
            {
                showHideButton("register-in", "show");
                showHideButton("register-in-out-placeholder", "hide")
            } else {
                showToast("error", 'Attendance System Error : ' + error.errors.message);
            }
        }
    } catch (error) {
        showHideButton("register-in", "hide");
        showHideButton("register-out", "hide");
        showHideButton("register-in-out-placeholder", "show")
        showToast("error", 'Attendance System Error : ' + ERROR_MEG.INTERNAL_ERROR);
    }
});

/**
 * get tasklist for scrum
 * populate tasks in today's task dropdown
 * display today's scrum if already done in bms work
 */
document.addEventListener("DOMContentLoaded", async () => {
    await populateTaskListAndScrum();

    // Fetch and display today's total task time for the user
    const userInfo = await window.WatchAPI.getUserInfo();
    startTodaysTotalTaskTimeCounter(userInfo.user.user_id);

    // display break time
    displayTotalBreakTime();
});

// Show and hide the "No Tracking Reminder" block
document.addEventListener('DOMContentLoaded', async () => {
    window.WatchAPI.userNoTrackingReminder((data) => {
        const taskNotStartedElement = document.getElementById('taskNotStarted');
        if (taskNotStartedElement) {
            taskNotStartedElement.className = 'card';
            
            if (data.noTrackingReminderBlock) {
                taskNotStartedElement.classList.add(data.noTrackingReminderBlock);
            }
        }
    });
})

document.getElementById('reports-external-link').addEventListener('click', (event) => {
    event.preventDefault();
    const url = BMS_EXTERNAL_LINKS.WORKS;
    window.WatchAPI.openExternal(url);
});

document.addEventListener("DOMContentLoaded", async () => {
    await window.WatchAPI.updatePrimaryTeam();
});