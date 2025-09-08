document.getElementById('checkForConnection').addEventListener('click', async (event) => {
    const internetCheckBtn = document.getElementById("checkForConnection");
    try {
        event.preventDefault();
        internetCheckBtn.innerText = "Processing...";
        internetCheckBtn.disabled = true;
        const netStatus = await window.WatchAPI.checkInternetConnectivity();
        if(netStatus == true) {
            window.WatchAPI.noInternet();
        }
    } catch (error) {
        
    } finally {
        internetCheckBtn.innerText = "Check for Internet";
        internetCheckBtn.disabled = false;
    }
    
});