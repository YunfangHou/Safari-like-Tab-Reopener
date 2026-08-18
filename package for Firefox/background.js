const EXCLUDED_WEBSITES_MENU_ID = 'open-excluded-websites';

browser.runtime.onInstalled.addListener(function () {
    browser.contextMenus.removeAll().then(function () {
        browser.contextMenus.create({
            id: EXCLUDED_WEBSITES_MENU_ID,
            title: 'Excluded websites',
            contexts: ['browser_action']
        });
    });
});

browser.contextMenus.onClicked.addListener(function (info) {
    if (info.menuItemId === EXCLUDED_WEBSITES_MENU_ID) {
        browser.tabs.create({ url: browser.runtime.getURL('options.html') });
    }
});

browser.runtime.onMessage.addListener(function(message) {
    if (message.command === "reopen_last_tab") {
        browser.sessions.restore();
    }
});
