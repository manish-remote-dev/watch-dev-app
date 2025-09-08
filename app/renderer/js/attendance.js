const registerInButton = document.getElementById("register-in");
registerInButton.addEventListener("click", async function (event) {
    event.preventDefault();
    try {
        registerInButton.innerText = "Processing...";
        registerInButton.disabled = true;
        const registerInUrl = BASE_URL.HR_API_BASE_URL + API_ENDPOINT.REGISTER_IN;
        const requestInfo = {
            method: "POST",
            url: registerInUrl,
            authType : 'bearertoken',
        }
        const registerInResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo)
        if (registerInResponse && registerInResponse.data.data.status == "success") {
            const logInTime = registerInResponse.data.data.data.login_time;
            const convertedLoginTime = await convertUTCTimeToTimezone(logInTime.date)
            showHideButton("register-in", "hide")
            showHideButton("register-out", "show")
            displayTime("in-time", convertedLoginTime)
        }
        if (registerInResponse && registerInResponse.data.errors) {
            error = await formatBMSAPIError(registerInResponse.data)
            showHideButton("register-in", "show")
            showHideButton("register-out", "hide")
            showToast("error", 'Register In Error : ' + error.errors.message);
        }
    } catch (error) {
        showToast("error", ERROR_MEG.INTERNAL_ERROR);
    } finally {
        registerInButton.innerText = "Register In";
        registerInButton.disabled = false;
    }
});

const registerOutButton = document.getElementById("register-out");
registerOutButton.addEventListener("click", async function (event) {
    event.preventDefault();
    try {
        registerOutButton.innerText = "Processing...";
        registerOutButton.disabled = true;
        const registerOutUrl = BASE_URL.HR_API_BASE_URL + API_ENDPOINT.REGISTER_OUT;
        const requestInfo = {
            method: "PUT",
            url: registerOutUrl,
            authType : 'bearertoken',
        }
        const registerOutResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo)
        if (registerOutResponse && registerOutResponse.data.data.status == "success") {
            const logoutTime = registerOutResponse.data.data.data.logout_time;
            const convertedLogoutTime = await convertUTCTimeToTimezone(logoutTime.date)
            displayTime("out-time", convertedLogoutTime)
        }
        if (registerOutResponse && registerOutResponse.data.errors) {
            error = await formatBMSAPIError(registerOutResponse.data)
        }
    } catch (error) {
        showToast("error", ERROR_MEG.INTERNAL_ERROR);
    } finally {
        registerOutButton.innerText = "Register Out";
        registerOutButton.disabled = false;
    }
})