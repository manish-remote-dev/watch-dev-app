var closeWorkEntryBtn = document.querySelector("#closeWorkEntryBtn");
closeWorkEntryBtn.addEventListener("click", async function () {
    //document.querySelector('#workEntryModal #workEntryTime').value = '';
    let currentTrackingDetails = await window.WatchAPI.currentRunningTask();
    await window.WatchAPI.stopTask(currentTrackingDetails.id);
    document.getElementById("postWorkEntry").reset();
    stopUsersTotalTaskTimeCounter();
});

const workEntryForm = document.getElementById("postWorkEntry");
workEntryForm.addEventListener("submit", async (e) => {
    let requestInfo = {};
    try {
        e.preventDefault();
        e.stopPropagation();
        workEntryBtn = document.getElementById("workEntryBtn");
        workEntryBtn.innerText = "Processing...";
        workEntryBtn.disabled = true;

        const formData = new FormData(workEntryForm);
        const formObject = Object.fromEntries(formData);
        const tempObject = Object.fromEntries(formData);
        //console.log("formObject", tempObject);
         
        const timeParts = formObject.work_entry_time.split(':');
        const hoursFromTime = parseInt(timeParts[0], 10);
        const minutesFromTime = parseInt(timeParts[1], 10);
        const secondsFromTime = parseInt(timeParts[2], 10);

        const totalTimeInSeconds = (hoursFromTime * 3600) + (minutesFromTime * 60) + secondsFromTime;
        const timeInHours = totalTimeInSeconds / 3600;

        const workedHours = parseFloat(formObject.worked_hour);
        const totalWorkedHours = workedHours + timeInHours;

        formObject.worked_hour = totalWorkedHours.toFixed(2);

        //console.log("Updated formObject after calculation:", formObject);

        let currentTrackingDetails = await window.WatchAPI.currentRunningTask();

        if (formObject.comment) {
            await window.WatchAPI.updateWorkEntryStatus(currentTrackingDetails.id, formObject.comment);
        }
        const workEntryURL = BASE_URL.TASK_API_BASE_URL + API_ENDPOINT.WORK_ENTRY;
        requestInfo = {
            method: "POST",
            url: workEntryURL,
            authType : 'bearertoken',
            requestData: formObject
        }
        const workEntryResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo);
        if (workEntryResponse && workEntryResponse.data.data) {
            showToast("success", workEntryResponse.data.data.message);
            closeWorkEntryBtn.click();
        }
        if (workEntryResponse && workEntryResponse.data.errors)
        {
            const formattedError = await formatBMSAPIError(workEntryResponse.data)
            showToast("error", formattedError.errors.message);
        }
    } catch (error) {
        showToast("error", ERROR_MEG.WORK_ENTRY_ERROR);
        closeWorkEntryBtn.click();
    } finally {
        workEntryBtn.innerText = "Submit";
        workEntryBtn.disabled = false;
    }
});