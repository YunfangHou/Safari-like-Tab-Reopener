chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.command === "reopen_last_tab") {
        chrome.sessions.restore();
    }
});
