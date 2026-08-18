const EXCLUDED_WEBSITES_MENU_ID = 'open-excluded-websites';

chrome.runtime.onInstalled.addListener(function () {
    chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
            id: EXCLUDED_WEBSITES_MENU_ID,
            title: 'Excluded websites',
            contexts: ['action']
        });
    });
});

chrome.contextMenus.onClicked.addListener(function (info) {
    if (info.menuItemId === EXCLUDED_WEBSITES_MENU_ID) {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.command === "reopen_last_tab") {
        chrome.sessions.restore();
    }
});
