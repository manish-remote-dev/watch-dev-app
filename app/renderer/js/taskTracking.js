async function taskStartStopMethod(event) {
    event.preventDefault();
    event.stopPropagation();
    const thisTrackButton = event.target;
    thisTrackButton.disabled = true;

    const taskStatus = thisTrackButton.dataset.currentstatus;
    const thisTaskRowHtml = thisTrackButton.closest(".eachTaskWrap");
    const thisTaskId = thisTaskRowHtml.dataset.taskId;
    const thisTaskTitle = thisTaskRowHtml.dataset.taskTitle;
    const thisProjectId = thisTaskRowHtml.dataset.projectId;
    const thisProjectName = thisTaskRowHtml.dataset.projectName;
    const thisTeamId = thisTaskRowHtml.dataset.teamId;
    const thisTeamName = thisTaskRowHtml.dataset.teamName;
    const thisUserId = thisTaskRowHtml.dataset.userId;

    if (taskStatus === 'stop') {
        try {
            const currentRunningBreak = await window.WatchAPI.currentRunningBreak();
            if (currentRunningBreak) {
                // await stopBreak(currentRunningBreak.break_id);
                showToast("error", "A break is currently running. Please stop the break first.");
            } else {
                const currentRunningTask = await window.WatchAPI.currentRunningTask();
                if (currentRunningTask) {
                    showToast("error", WARNING_MSG.STOP_CURRENT_TASK)
                } else {
                    await startTask(thisTaskRowHtml, thisTaskId, thisTaskTitle, thisProjectId, thisProjectName, thisTeamId, thisTeamName);
                    stopTaskTimeBadge();
                    updateTaskTimeBadge(thisTaskId, document.getElementById(`task-time-badge-${thisTaskId}`));
                    startTodaysTotalTaskTimeCounter(thisUserId);
                }
            }
        } catch (error) {
            console.log("error from taskStartStopMethod stop condition", error);
            showToast("error", ERROR_MEG.TASK_START_ERROR)
        } finally {
            thisTrackButton.disabled = false;
        }
    }

    if (taskStatus === 'start') {
        try {
            const taskTrackingDetails = await window.WatchAPI.unfinishedTaskTrackingDetails(thisTaskId);
            await makeWorkEntry(taskTrackingDetails);
            //await stopTask(thisTaskRowHtml, taskTrackingDetails.id); 8-1-25
            //stopTaskTimeBadge();
        } catch (error) {
            console.log("error from taskStartStopMethod start condition", error);
            showToast("error", ERROR_MEG.TASK_STOP_ERROR)
        } finally {
            thisTrackButton.disabled = false;
        }
    }
}

async function makeWorkEntry(taskTrackingDetails) {
    elapsedTimeInSeconds = 0;
    document.querySelector('#workEntryModal #workEntryTime').value = '00:00:00';

    const workEntryModal = new bootstrap.Modal(
        document.getElementById("workEntryModal"),
        {backdrop: "static",}
    );
    document.querySelector('#workEntryModal .taskName').textContent = taskTrackingDetails.task_title;
    document.querySelector('#workEntryModal .taskId').value = taskTrackingDetails.task_id;
    document.querySelector('#workEntryModal .projectId').value = taskTrackingDetails.project_id;
    document.getElementById("workDate").value = taskTrackingDetails.created_at.split('T')[0];
    document.querySelector('#workEntryModal .workEntryComment').value = '';

    const taskTrackedTime = await window.WatchAPI.getTaskTrackedTime(taskTrackingDetails.id);
    const trackedTimeInHour = (taskTrackedTime/3600).toFixed(2);
    document.querySelector("#postWorkEntry #spentHours").value = trackedTimeInHour;
    document.querySelector("#postWorkEntry #spentHoursDisplay").value = convertSecondsToHoursAndMinutes(taskTrackedTime);

    workEntryModal.show();

    startTimer();

    workEntryModal._element.addEventListener('hidden.bs.modal', function () {
        stopTimer();
    });
}

async function startTask(taskRowHtml, taskId, taskTitle, projectId, projectName, team_id, team_name) {
    const startStopButton = taskRowHtml.querySelector(".taskStartStop");
    const startStopFlag = taskRowHtml.querySelector(".start-stop-flag");

    try {
        startStopButton.innerText = "Processing...";
        startStopButton.disabled = true;
        const startTaskResponse = await window.WatchAPI.startTask(taskId, taskTitle, projectId, projectName, 'working', team_id, team_name);
        if (startTaskResponse) {
            startStopButton.dataset.currentstatus = "start"
            startStopButton.classList.remove("btn-green");
            startStopButton.classList.add("btn-red");
            startStopButton.innerText = "Stop";
            startStopFlag.classList.add("bg-red");

            startStopFlag.classList.add("bg-green");
            startStopFlag.classList.remove("bg-red");
            return true;
        } else {
            throw new Error("Start task error");
        }
    } catch (error) {
        startStopButton.textContent = "Start";
        // const err = await formatSQLError(error.message);
        // throw new Error(err.message);
        throw error;
    } finally {
        startStopButton.disabled = false;
    }
}

async function stopTask(taskRowHtml, trackingId) {
    const startStopButton = taskRowHtml.querySelector(".taskStartStop");
    const startStopFlag = taskRowHtml.querySelector(".start-stop-flag");

    try {
        startStopButton.innerText = "Processing...";
        startStopButton.disabled = true;
        const stopTaskResponse = await window.WatchAPI.stopTask(trackingId);
        if (stopTaskResponse) {
            startStopButton.dataset.currentstatus = "stop"
            startStopButton.classList.remove("btn-red");
            startStopButton.classList.add("btn-green");
            startStopButton.innerText = "Start";
            startStopFlag.classList.remove("bg-green");
            startStopFlag.classList.add("bg-red");
            return true;
        } else {
            throw new Error("Stop task error");
        }
    } catch (error) {
        startStopButton.textContent = "Stop";
        throw error;
    } finally {
        startStopButton.disabled = false;
    }
}

// Function to handle and update the time badge per second only for the running task
async function updateTaskTimeBadge(taskId, taskBadgeElement) {
    try {
      let taskTimeInSeconds = await window.WatchAPI.getEachTaskWorkLogInfo(taskId);
  
      // Clear any existing interval to prevent multiple intervals
      clearInterval(currentTaskInterval);
  
      // Update the badge every second for the current running task
      currentTaskInterval = setInterval(() => {
        taskTimeInSeconds++;
        taskBadgeElement.textContent = formatTime(taskTimeInSeconds);
      }, 1000);
    } catch (error) {
      console.error("Error updating task time badge:", error);
    }
}
  
// Function to stop the counter for the current running task
function stopTaskTimeBadge() {
    if (currentTaskInterval) {
      clearInterval(currentTaskInterval);
      currentTaskInterval = null;
    }
}

// Timer logic
let timerInterval;
let elapsedTimeInSeconds = 0; // Track elapsed time in seconds

function startTimer() {
    const workEntryTimeInput = document.getElementById('workEntryTime');
    workEntryTimeInput.value = "00:00:00";

    timerInterval = setInterval(function () {
        elapsedTimeInSeconds++;
        workEntryTimeInput.value = formatTime(elapsedTimeInSeconds);
    }, 1000);
}

function stopTimer() {
    // Clear the interval when the modal is closed
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}

function formatTime(seconds) {
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const remainingSeconds = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${remainingSeconds}`;
}

let totalTaskTimeInterval;

async function startTodaysTotalTaskTimeCounter(userId) {
    let totalTaskTimeInSeconds = await window.WatchAPI.getTodaysTotalTaskTimeUserWise(userId);
    currentRunningTask = await window.WatchAPI.currentRunningTask();
    if( currentRunningTask ) {
        clearInterval(totalTaskTimeInterval);
        totalTaskTimeInterval = setInterval(async () => {
                totalTaskTimeInSeconds++;
                document.getElementById('todays-total-task-time').textContent = convertSecondsToHoursAndMinutes(totalTaskTimeInSeconds);
            }, 1000);
    } else {
        document.getElementById('todays-total-task-time').textContent = convertSecondsToHoursAndMinutes(totalTaskTimeInSeconds);
    }
}

function stopUsersTotalTaskTimeCounter() {
    if (totalTaskTimeInterval) {
        clearInterval(totalTaskTimeInterval);
        totalTaskTimeInterval = null;
    }
}