const loginForm = document.getElementById("loginForm");
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loginForm.checkValidity()) {
        loginForm.classList.add('was-validated');
        return;
    }
    try {
        const loginBtn = document.getElementById("loginBtn");
        loginBtn.innerText = "Processing...";
        loginBtn.disabled = true;

        const formData = new FormData(loginForm);
        const formObject = Object.fromEntries(formData);
        const loginUrl = BASE_URL.ACCOUNT_API_BASE_URL + API_ENDPOINT.LOGIN
        const requestInfo = {
            method: "POST",
            url: loginUrl,
            authType : 'basic',
            requestData: formObject
        }

        const loginResponse = await window.WatchAPI.makeAsyncApiRequest(requestInfo)

        if ( loginResponse && loginResponse.data.data ) {
            window.WatchAPI.loginSuccess(loginResponse.data.data)
        }

        if( loginResponse && loginResponse.data.errors )
        {
            error = await formatBMSAPIError(loginResponse.data)
            displayLoginError("responseError", error.errors.message)
        }
    } catch (error) {
        //const errorData = await formatIpcHandlerError(error.message)
        displayLoginError("responseError", ERROR_MEG.INTERNAL_ERROR)
    } finally {
        loginBtn.innerText = "Login";
        loginBtn.disabled = false;
    }
});

function displayLoginError(locationId, message) {
    document.getElementById(locationId).innerText = message;
}

document.getElementById('logo-external-link').addEventListener('click', (event) => {
    event.preventDefault();
    const url = BMS_EXTERNAL_LINKS.WEBSITE;
    window.WatchAPI.openExternal(url);
});
