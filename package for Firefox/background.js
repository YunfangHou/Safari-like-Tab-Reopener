const EXCLUDED_WEBSITES_MENU_ID = 'open-excluded-websites';
const DEFAULT_EXCLUDED_HOSTS = [
    'app.diagrams.net',
    'canva.com',
    'excalidraw.com',
    'figma.com',
    'photopea.com',
    'tldraw.com'
];

function setExclusionBadge(tabId, excluded) {
    browser.browserAction.setBadgeText({
        tabId,
        text: excluded ? browser.i18n.getMessage('badgeOff') : ''
    });

    if (excluded) {
        browser.browserAction.setBadgeBackgroundColor({
            tabId,
            color: '#666666'
        });
    }
}

browser.runtime.onInstalled.addListener(function (details) {
    if (details.reason === 'install') {
        browser.storage.local.set({ excludedHosts: DEFAULT_EXCLUDED_HOSTS });
    }

    browser.contextMenus.removeAll().then(function () {
        browser.contextMenus.create({
            id: EXCLUDED_WEBSITES_MENU_ID,
            title: browser.i18n.getMessage('excludedWebsites'),
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
