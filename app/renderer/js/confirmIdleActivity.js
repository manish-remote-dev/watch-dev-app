const { ACTIVITY_TIMEOUT_COUNTER } = window.config;
let countdownTime = parseInt(ACTIVITY_TIMEOUT_COUNTER);
updateCountdown();

// Function to update the countdown timer display
async function updateCountdown() {
    try {
        document.getElementById('countdown').textContent = countdownTime;
        countdownTime--;

        if (countdownTime >= 0) {
            setTimeout(updateCountdown, 1000); // Schedule the next countdown update
        } else {
            window.WatchAPI.idleDetection();
        }
    } catch (error) {
        throw error;
    }
}

document.getElementById('not-idle').addEventListener('click', () => {
    window.WatchAPI.activeDetection();
});

// Monitor key press and mouse movement
const handleActivity = () => {
    activityDetected = true;
    window.WatchAPI.activeDetection();
};

document.addEventListener('click', handleActivity);
document.addEventListener('keydown', handleActivity);