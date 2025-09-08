const { BASE_URL, API_ENDPOINT, ERROR_MEG, WARNING_MSG, BMS_EXTERNAL_LINKS, BMS_EXTERNAL_LINKS_END_POINTS, USER_TIMEZONE, ACTIVITY_TIMEOUT_COUNTER } = window.config;

async function formatBMSAPIError(input) {
    if (Array.isArray(input.errors) && input.errors.length > 0) {
        return {
            errors: input.errors[0]
        };
    } else {
        throw new Error("Input does not contain a valid errors array");
    }
}

async function formatIpcHandlerError(input) {
    if (typeof input === "string") {
        const inputArray = input.split(":");
        return { name: inputArray[1], message: inputArray[2] };
    } else {
        throw new Error("Input is not valid string");
    }
}

async function formatSQLError(input) {
    if (typeof input === "string") {
        const inputArray = input.split(":");
        return { name: inputArray[1], message: inputArray[4] };
    } else {
        throw new Error("Input is not valid string");
    }
}

function showToast(type, message) {
    toastr[type](message);
}
async function checkAttendanceStatus() {
    try {
        const attendanceStatusUrl = BASE_URL.HR_API_BASE_URL + API_ENDPOINT.ATTENDANCE_STATUS
        const requestInfo = {
            method: "GET",
            url: attendanceStatusUrl,
            authType : 'bearertoken'
        }
        const attendanceStatusResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo);
        return attendanceStatusResponse;
    } catch (error) {
        throw error;
    }
}

function displayTime(elementId, time) {
    document.getElementById(elementId).textContent = time;
}

function showHideButton(buttonId, action) {
    switch (action) {
        case "show" :
            document.getElementById(buttonId).classList.remove("d-none");
            break;
        case "hide" :
            document.getElementById(buttonId).classList.remove("d-none");
            document.getElementById(buttonId).classList.add("d-none");
            break;
        default:
            alert(ERROR_MEG.INTERNAL_ERROR);
            break;
    }
}

async function convertUTCTimeToTimezone(utcDateString) {
    try {
        if (utcDateString == null ) {
            return null;
        }
        const isoFormattedString = utcDateString.replace(" ", "T") + "Z";
        const utcDate = new Date(isoFormattedString);

        if (isNaN(utcDate)) {
            throw new Error("Invalid date format");
        }

        const formatOptions = {
            timeZone: USER_TIMEZONE,
            hour12: true,
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
        };
        return utcDate.toLocaleTimeString("en-US", formatOptions);
    } catch (error) {
        throw new Error(error.message);
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return (
      String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0') + ':' +
      String(remainingSeconds).padStart(2, '0')
    );
  }