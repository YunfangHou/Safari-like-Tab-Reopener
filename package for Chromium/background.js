const EXCLUDED_WEBSITES_MENU_ID = 'open-excluded-websites';
const SETTINGS_MENU_ID = 'open-settings';
const TOOLBAR_CLICK_ACTION_KEY = 'toolbarClickAction';
let toolbarTask = Promise.resolve();

// Serialize temporary popup bindings with preference changes and worker startup.
function queueToolbarTask(task) {
    const result = toolbarTask.then(task);
    toolbarTask = result.catch(error => console.warn('Unable to update toolbar action:', error));
    return result;
}

async function applyToolbarClickAction() {
    const stored = await chrome.storage.local.get(TOOLBAR_CLICK_ACTION_KEY);
    const restore = stored[TOOLBAR_CLICK_ACTION_KEY] === 'restore';
    await chrome.action.setPopup({ popup: restore ? '' : 'popup.html' });
    await chrome.action.setTitle({
        title: chrome.i18n.getMessage(restore ? 'restoreToolbarTooltip' : 'extensionSettings')
    });
}

async function openSettingsPopup(windowId) {
    try {
        await chrome.action.setPopup({ popup: 'popup.html' });
        await chrome.action.openPopup(Number.isInteger(windowId) ? { windowId } : {});
    } finally {
        // Clear the temporary binding even if opening fails, using the latest preference.
        await applyToolbarClickAction();
    }
}

chrome.action.onClicked.addListener(tab => {
    queueToolbarTask(async () => {
        const stored = await chrome.storage.local.get(TOOLBAR_CLICK_ACTION_KEY);
        if (stored[TOOLBAR_CLICK_ACTION_KEY] === 'restore') {
            try {
                await chrome.sessions.restore();
            } catch (error) {
                // Chrome rejects when there is no recently closed session to restore.
                console.debug('Unable to restore a closed session:', error);
            }
        } else {
            await openSettingsPopup(tab.windowId);
        }
    });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[TOOLBAR_CLICK_ACTION_KEY]) {
        queueToolbarTask(applyToolbarClickAction);
    }
});
chrome.runtime.onStartup.addListener(() => queueToolbarTask(applyToolbarClickAction));
queueToolbarTask(applyToolbarClickAction);
const EXCLUDED_HOSTS_TEXT_KEY = 'excludedHostsText';
const DEFAULT_EXCLUDED_HOSTS = [
    'app.diagrams.net',
    'canva.com',
    'excalidraw.com',
    'figma.com',
    'photopea.com',
    'tldraw.com'
];

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

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === 'install') {
        const defaultExcludedHostsText = [
            `# ${chrome.i18n.getMessage('defaultExcludedHostsComment')}`,
            ...DEFAULT_EXCLUDED_HOSTS
        ].join('\n');
        chrome.storage.local.set({
            excludedHosts: DEFAULT_EXCLUDED_HOSTS,
            [EXCLUDED_HOSTS_TEXT_KEY]: defaultExcludedHostsText
        });
    }

    chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
            id: SETTINGS_MENU_ID,
            title: chrome.i18n.getMessage('extensionSettings'),
            contexts: ['action']
        });
        chrome.contextMenus.create({
            id: EXCLUDED_WEBSITES_MENU_ID,
            title: chrome.i18n.getMessage('excludedWebsites'),
            contexts: ['action']
        });
    });
    queueToolbarTask(applyToolbarClickAction);
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === SETTINGS_MENU_ID) {
        queueToolbarTask(() => openSettingsPopup(tab?.windowId));
        return;
    }
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
    if (message.command === 'apply_toolbar_click_action') {
        queueToolbarTask(applyToolbarClickAction).then(
            () => sendResponse({ ok: true }),
            () => sendResponse({ ok: false })
        );
        return true;
    }
    if (message.command === 'set_exclusion_state' && sender.tab) {
        setExclusionBadge(sender.tab.id, Boolean(message.excluded));
        return;
    }

    if (message.command === "reopen_last_tab") {
        chrome.sessions.restore();
    }
});
