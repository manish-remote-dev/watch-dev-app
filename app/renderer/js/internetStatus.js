let wifiStatusIcon = 'placeholder';
let onWindowOpen = true;
let previousNetStatusLog = '';
let isInternetLost;
let netStatusLog;
const checkConnectivity = async () => {
    try {
        document.getElementById('wifistatus').className = "spinner-border spinner-border-sm";
        const netStatus = await window.WatchAPI.checkInternetConnectivity();
        isInternetLost = (netStatus) ? false : true;
    } catch (e) {
        console.error("Error in checking internet connectivity: ", e);
    }
  
}
const updateInternetStatus = async () => {
  wifiStatusIcon = (!isInternetLost) ? "bi bi-wifi" : "bi bi-wifi-off";
  netStatusLog = (!isInternetLost) ? "online" : "offline";
  document.getElementById('wifistatus').className = wifiStatusIcon;
  if (netStatusLog !== previousNetStatusLog) {
    if ((onWindowOpen && isInternetLost) || !onWindowOpen) {
      notify(netStatusLog);
      window.WatchAPI.logNetStatusChange(netStatusLog);
    }
  }
  previousNetStatusLog = netStatusLog;
}
function notify() {
  const NOTIFICATION_TITLE = 'Watch APP';
  let NOTIFICATION_BODY;
  if (netStatusLog == 'online') {
    NOTIFICATION_BODY = 'Your internet connectivity has been restored';
  }
  else {
    NOTIFICATION_BODY = 'You do not have active internet connection.';
  }
  new Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY })
}
window.addEventListener('online', async (e) => {
  onWindowOpen = false;
  await checkConnectivity();
  updateInternetStatus();
})
window.addEventListener('offline', async (e) => {
  onWindowOpen = false;
  await checkConnectivity();
  updateInternetStatus();
})
document.addEventListener("DOMContentLoaded", async function (event) {
  await checkConnectivity();
  updateInternetStatus();
});
