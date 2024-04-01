browser.runtime.onMessage.addListener(function(message) {
    if (message.command === "reopen_last_tab") {
        browser.sessions.restore();
    }
});
