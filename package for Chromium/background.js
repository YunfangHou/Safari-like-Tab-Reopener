const EXCLUDED_WEBSITES_MENU_ID = 'open-excluded-websites';

function setExclusionBadge(tabId, excluded) {
    chrome.action.setBadgeText({
        tabId,
        text: excluded ? chrome.i18n.getMessage('badgeOff') : ''
    });

    if (excluded) {
        chrome.action.setBadgeBackgroundColor({
            tabId,
            color: '#666666'
        });
    }
}

chrome.runtime.onInstalled.addListener(function () {
    chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
            id: EXCLUDED_WEBSITES_MENU_ID,
            title: chrome.i18n.getMessage('excludedWebsites'),
            contexts: ['action']
        });
    });
});

chrome.contextMenus.onClicked.addListener(function (info) {
    if (info.menuItemId === EXCLUDED_WEBSITES_MENU_ID) {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'loading') {
        setExclusionBadge(tabId, false);
    }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.command === 'set_exclusion_state' && sender.tab) {
        setExclusionBadge(sender.tab.id, Boolean(message.excluded));
        return;
    }

    if (message.command === "reopen_last_tab") {
        chrome.sessions.restore();
    }
});
