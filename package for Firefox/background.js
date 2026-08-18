const EXCLUDED_WEBSITES_MENU_ID = 'open-excluded-websites';

function setExclusionBadge(tabId, excluded) {
    browser.browserAction.setBadgeText({
        tabId,
        text: excluded ? 'OFF' : ''
    });

    if (excluded) {
        browser.browserAction.setBadgeBackgroundColor({
            tabId,
            color: '#666666'
        });
    }
}

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

browser.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'loading') {
        setExclusionBadge(tabId, false);
    }
});

browser.runtime.onMessage.addListener(function(message, sender) {
    if (message.command === 'set_exclusion_state' && sender.tab) {
        setExclusionBadge(sender.tab.id, Boolean(message.excluded));
        return;
    }

    if (message.command === "reopen_last_tab") {
        browser.sessions.restore();
    }
});
