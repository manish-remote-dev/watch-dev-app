if (window.WatchAPI) {
    window.WatchAPI.onUserIdle((data) => {
        if (data.idleStartTime) {
            const idleStartTime = new Date(data.idleStartTime);
            const formattedTime = idleStartTime.toLocaleString();
            document.getElementById('idle-since-time').textContent = `Idle since: ${formattedTime}`;
        }
    });
}

document.getElementById('working').addEventListener('click', () => {
    //window.WatchAPI.send('user-working-response', 'working');
    window.WatchAPI.userWorkingResponse('working');
});

document.getElementById('not-working').addEventListener('click', () => {
    //window.WatchAPI.send('user-working-response', 'not-working');
    window.WatchAPI.userWorkingResponse('not-working');
});