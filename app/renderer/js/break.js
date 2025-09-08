let breakTimerInterval;

/**
 * Display Break Buttons and Check for a Running Break on Load
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const userInfo = await window.WatchAPI.getUserInfo();
        const currentUserId = userInfo.user.user_id;
        
        // Fetch all breaks
        const allBreakInfo = await window.WatchAPI.getBreaks({ userId: currentUserId });
        let buttonHtml = '';

        for (const eachBreakButton of allBreakInfo) {
            buttonHtml += `
                <div class="d-flex align-items-center mb-3 gap-2" style="margin-right: 8px;">
                    <button type="button" class="btn btn-secondary break-button" id="${eachBreakButton._id}" onClick="takeBreakMethod(event);">
                        ${eachBreakButton.break_name} <i class="bi bi-play" id="icon-${eachBreakButton._id}"></i>
                    </button>
                </div>`;
        }

        // Insert the generated buttons into the 'break-buttons-inner' element
        document.querySelector('.break-buttons-inner').innerHTML = buttonHtml;

        // Check if a break is currently running and resume it
        const currentRunningBreak = await window.WatchAPI.currentRunningBreak();
        if (currentRunningBreak) {
            //console.log("Resuming running break:", currentRunningBreak);
            resumeRunningBreak(currentRunningBreak);
        }
    } catch (error) {
        console.error("Error initializing breaks:", error);
        showToast("error", "Works System Error: Unable to initialize breaks.");
    }
});

async function takeBreakMethod(event) {
    const taskButtons = document.querySelectorAll('.taskStartStop');
    try {
        taskButtons.forEach(button => button.disabled = true);

        const breakId = event.target.id;
        const buttonElement = event.target;
        const iconElement = document.getElementById(`icon-${breakId}`);
        
        buttonElement.disabled = true;

        if (iconElement.classList.contains("bi-pause")) {
            await stopBreak(breakId);
        } else {
            // taskButtons.forEach(button => button.disabled = true);
            iconElement.disabled = true;
            let currentRunningTask = await window.WatchAPI.currentRunningTask();

            if (currentRunningTask) {
                showToast("error", "Break did not start. Please stop the current task first.");
                taskButtons.forEach(button => button.disabled = false);
                
                //console.log("Current running task found:", currentRunningTask);
                // const startedButton = document.querySelector('.taskStartStop[data-currentstatus="start"]');
                // taskButtons.forEach(button => button.disabled = false);
                // if (startedButton) {
                    
                //     startedButton.click();
                //     await new Promise(resolve => setTimeout(resolve, 100));
                //     currentRunningTask = await window.WatchAPI.currentRunningTask();

                //     if (currentRunningTask) {
                //         showToast("error", "Break did not start. Please stop the current task first.");
                //     } else {
                //         await startBreak(breakId);
                //     }
                // } else {
                //     taskButtons.forEach(button => button.disabled = false);
                //     console.log("No button with data-currentstatus='start' found.");
                // }
            } else {
                
                let currentRunningBreak = await window.WatchAPI.currentRunningBreak();

                if (currentRunningBreak) {
                    await stopBreak(currentRunningBreak.break_id);
                }
                // Start the break directly if no tasks are running
                await startBreak(breakId);
                taskButtons.forEach(button => button.disabled = false);
            }
        }
    } catch (error) {
        console.error("Error in takeBreakMethod:", error);
        showToast("error", "An error occurred: " + error.message);
    } finally {
        // taskButtons.forEach(button => button.disabled = false);
        event.target.disabled = false;
    }
}

async function startBreak(breakId) {
    try {
        // Start break via API call to main process
        await window.WatchAPI.startBreak(breakId);

        // Reset all icons to play state
        document.querySelectorAll('.bi-play, .bi-pause').forEach(icon => {
            icon.classList.remove('bi-pause');
            icon.classList.add('bi-play');
        });

        // Change the icon for the active break to pause
        const iconElement = document.getElementById(`icon-${breakId}`);
        if (iconElement) {
            iconElement.classList.remove('bi-play');
            iconElement.classList.add('bi-pause');
        }

        // Clear any existing timer
        clearInterval(breakTimerInterval);

        // Insert the break running box into `breakRunningHtml`
        const breakRunningHtml = document.querySelector('.breakRunningHtml');
        const breakTitle = document.getElementById(breakId).innerText.trim();
        breakRunningHtml.innerHTML = `
        <div class="card-body profile-card pt-4 d-flex flex-column align-items-center text-center">
                <div class="d-flex flex-column">
                    <i class="bi bi-cup-hot-fill fs-1"></i> <h3>${breakTitle}</h3>
                    <div>Time spent: <span id="break-timer">00:00:00</span></div>
                </div>
                <button class="btn btn-danger ms-3 mt-2" onclick="stopBreak('${breakId}')">Stop Break</button>
        </div>
        `;

        // Start the timer
        const startTime = Date.now();
        breakTimerInterval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            document.getElementById('break-timer').textContent = formatBreakTime(elapsedTime);
        }, 1000);

        
        window.scrollTo(0, 0);
    } catch (error) {
        console.error("Failed to start break:", error);
        showToast("error", "Failed to start break. Please try again.");
    }
}

function resumeRunningBreak(runningBreak) {
    const breakId = runningBreak.break_id;
    const startTime = new Date(runningBreak.start_at).getTime();
    const elapsedTime = Date.now() - startTime;

    // Reset all icons to play state
    document.querySelectorAll('.bi-play, .bi-pause').forEach(icon => {
        icon.classList.remove('bi-pause');
        icon.classList.add('bi-play');
    });

    // Change the icon for the active break to pause
    const iconElement = document.getElementById(`icon-${breakId}`);
    if (iconElement) {
        iconElement.classList.remove('bi-play');
        iconElement.classList.add('bi-pause');
    }

    // Display the running break information
    const breakRunningHtml = document.querySelector('.breakRunningHtml');
    const breakTitle = document.getElementById(breakId).innerText.trim();
    breakRunningHtml.innerHTML = `
            <div class="card-body profile-card pt-4 d-flex flex-column align-items-center text-center">
                    <div class="d-flex flex-column">
                        <i class="bi bi-cup-hot-fill fs-1"></i> <h3>${breakTitle}</h3>
                        <div>Time spent: <span id="break-timer">00:00:00</span></div>
                    </div>
                    <button class="btn btn-danger ms-3 mt-2" onclick="stopBreak('${breakId}')">Stop Break</button>
            </div>  
         `;

    // Start the timer from the elapsed time
    clearInterval(breakTimerInterval);
    document.getElementById('break-timer').textContent = formatBreakTime(elapsedTime);
    breakTimerInterval = setInterval(() => {
        const currentElapsed = Date.now() - startTime;
        document.getElementById('break-timer').textContent = formatBreakTime(currentElapsed);
    }, 1000);
}

async function stopBreak(breakId) {
    //console.log("Stopping break with ID:", breakId);

    try {
        // Reset the icon back to play for the stopped break
        const iconElement = document.getElementById(`icon-${breakId}`);
        if (iconElement) {
            iconElement.classList.remove('bi-pause');
            iconElement.classList.add('bi-play');
        }

        // Clear the break running box and timer
        clearInterval(breakTimerInterval);
        document.querySelector('.breakRunningHtml').innerHTML = '';

        // Stop break via API call to main process
        const response = await window.WatchAPI.stopBreak(breakId);
        displayTotalBreakTime();
        //console.log("Break stopped successfully:", response);
    } catch (error) {
        console.error("Failed to stop break:", error);
        showToast("error", "Failed to stop break. Please try again.");
    }
}

// Helper function to format elapsed time
function formatBreakTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

async function displayTotalBreakTime() {
    userInfo = await window.WatchAPI.getUserInfo();
    let breakTimeResponse = await window.WatchAPI.getTodaysTotalBreakTimeUserWise(userInfo.user.user_id);
    if (breakTimeResponse && breakTimeResponse.data && breakTimeResponse.data.data) {
        const totalBreakTimeInSeconds = breakTimeResponse.data.data[0]?.totalBreakTime || 0;
        document.getElementById('todays-total-break-time').textContent = convertSecondsToHoursAndMinutes(totalBreakTimeInSeconds);
    }
    if(breakTimeResponse && breakTimeResponse.data && breakTimeResponse.data.errors) {
        document.getElementById('todays-total-break-time').textContent = 'Error : ' + breakTimeResponse.data.errors[0].message;
        document.getElementById('todays-total-break-time').style.color = "red";
    }
}