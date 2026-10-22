const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const EXCLUDED_HOSTS_KEY = 'excludedHosts';
const EXCLUDED_HOSTS_TEXT_KEY = 'excludedHostsText';
const SHOW_REOPEN_BUTTON_KEY = 'showReopenButton';
const TOOLBAR_CLICK_ACTION_KEY = 'toolbarClickAction';
const supportsToolbarClickAction = typeof extensionApi.action?.openPopup === 'function';
const toolbarClickActionSelect = document.getElementById('toolbar-click-action');
let toolbarClickAction = 'popup';
document.getElementById('toolbar-click-settings').hidden = !supportsToolbarClickAction;

const showReopenButtonCheckbox = document.getElementById('show-reopen-button');

const currentHostElement = document.getElementById('current-host');
const toggleCurrentButton = document.getElementById('toggle-current');
const excludedListElement = document.getElementById('excluded-list');
const emptyListElement = document.getElementById('empty-list');
const statusElement = document.getElementById('status');
const quickReportButton = document.getElementById('quick-report');
const describeReportButton = document.getElementById('describe-report');
const reportFormElement = document.getElementById('report-form');
const reportDescriptionElement = document.getElementById('report-description');

const DEVELOPER_EMAIL = 'Yunfang.Hou2001@gmail.com';

let currentHost = null;
let excludedHosts = [];
let excludedHostsText = '';

function matchingRule(hostname) {
    return excludedHosts.find(host =>
        hostname === host || hostname.endsWith(`.${host}`)
    );
}

function updateExcludedHostsText(hosts) {
    const remainingHosts = new Set(hosts);
    const lines = [];

    for (const line of excludedHostsText.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            if (trimmed || lines.length > 0) {
                lines.push(trimmed);
            }
        } else if (remainingHosts.delete(trimmed)) {
            lines.push(trimmed);
        }
    }

    for (const host of hosts) {
        if (remainingHosts.delete(host)) {
            lines.push(host);
        }
    }

    while (lines.at(-1) === '') {
        lines.pop();
    }

    return lines.join('\n');
}

async function saveHosts(hosts) {
    excludedHosts = [...new Set(hosts)].sort();
    excludedHostsText = updateExcludedHostsText(excludedHosts);
    await extensionApi.storage.local.set({
        [EXCLUDED_HOSTS_KEY]: excludedHosts,
        [EXCLUDED_HOSTS_TEXT_KEY]: excludedHostsText
    });
    render();
}

function render() {
    const matchedRule = currentHost ? matchingRule(currentHost) : null;

    currentHostElement.textContent = currentHost || localizeMessage('thisPageCannotBeExcluded');
    toggleCurrentButton.disabled = !currentHost;
    quickReportButton.disabled = !currentHost;
    describeReportButton.disabled = !currentHost;
    toggleCurrentButton.textContent = matchedRule
        ? localizeMessage('removeFromExclusions', matchedRule)
        : localizeMessage('excludeThisWebsite');

    excludedListElement.replaceChildren();
    emptyListElement.hidden = excludedHosts.length > 0;

    for (const host of excludedHosts) {
        const item = document.createElement('li');
        const label = document.createElement('span');
        const removeButton = document.createElement('button');

        label.textContent = host;
        removeButton.type = 'button';
        removeButton.className = 'remove';
        removeButton.textContent = localizeMessage('remove');
        removeButton.setAttribute('aria-label', localizeMessage('removeHost', host));
        removeButton.addEventListener('click', () => {
            saveHosts(excludedHosts.filter(itemHost => itemHost !== host)).catch(showError);
        });

        item.append(label, removeButton);
        excludedListElement.append(item);
    }
}

function openEmailReport(description) {
    if (!currentHost) {
        return;
    }

    const bodyLines = [`${localizeMessage('reportedWebsite')}: ${currentHost}`];
    if (description) {
        bodyLines.push('', `${localizeMessage('issueDescription')}:`, description);
    }
    const mailtoUrl = `mailto:${DEVELOPER_EMAIL}`
        + `?subject=${encodeURIComponent(localizeMessage('reportEmailSubject'))}`
        + `&body=${encodeURIComponent(bodyLines.join('\n'))}`;
    extensionApi.tabs.create({ url: mailtoUrl });
    window.close();
}

function showError() {
    statusElement.textContent = localizeMessage('unableUpdateList');
}

async function initialize() {
    const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
    const stored = await extensionApi.storage.local.get([EXCLUDED_HOSTS_KEY, EXCLUDED_HOSTS_TEXT_KEY, SHOW_REOPEN_BUTTON_KEY, TOOLBAR_CLICK_ACTION_KEY]);
    toolbarClickAction = stored[TOOLBAR_CLICK_ACTION_KEY] === 'restore' ? 'restore' : 'popup';
    toolbarClickActionSelect.value = toolbarClickAction;
    toolbarClickActionSelect.disabled = !supportsToolbarClickAction;
    showReopenButtonCheckbox.checked = stored[SHOW_REOPEN_BUTTON_KEY] === true;
    showReopenButtonCheckbox.disabled = false;
    excludedHosts = Array.isArray(stored[EXCLUDED_HOSTS_KEY]) ? stored[EXCLUDED_HOSTS_KEY] : [];
    excludedHostsText = typeof stored[EXCLUDED_HOSTS_TEXT_KEY] === 'string'
        ? stored[EXCLUDED_HOSTS_TEXT_KEY]
        : excludedHosts.join('\n');

    try {
        const url = new URL(tab.url);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            currentHost = url.hostname.toLowerCase();
        }
    } catch (error) {
        currentHost = null;
    }

    render();
}

toolbarClickActionSelect.addEventListener('change', async () => {
    if (!supportsToolbarClickAction) return;
    const previous = toolbarClickAction;
    const selected = toolbarClickActionSelect.value === 'restore' ? 'restore' : 'popup';
    toolbarClickActionSelect.disabled = true;
    try {
        await extensionApi.storage.local.set({ [TOOLBAR_CLICK_ACTION_KEY]: selected });
        const result = await extensionApi.runtime.sendMessage({ command: 'apply_toolbar_click_action' });
        if (!result?.ok) throw new Error('Unable to apply toolbar preference');
        toolbarClickAction = selected;
        statusElement.textContent = '';
    } catch (error) {
        // Keep the saved preference and the toolbar consistent if applying it fails.
        try {
            await extensionApi.storage.local.set({ [TOOLBAR_CLICK_ACTION_KEY]: previous });
            await extensionApi.runtime.sendMessage({ command: 'apply_toolbar_click_action' });
        } catch (rollbackError) {
            // The error below remains visible so the user can retry.
        }
        toolbarClickAction = previous;
        toolbarClickActionSelect.value = previous;
        statusElement.textContent = localizeMessage('unableSaveSettings');
    } finally {
        toolbarClickActionSelect.disabled = false;
    }
});

showReopenButtonCheckbox.addEventListener('change', async () => {
    const enabled = showReopenButtonCheckbox.checked;
    showReopenButtonCheckbox.disabled = true;
    try {
        await extensionApi.storage.local.set({ [SHOW_REOPEN_BUTTON_KEY]: enabled });
        statusElement.textContent = '';
    } catch (error) {
        showReopenButtonCheckbox.checked = !enabled;
        statusElement.textContent = localizeMessage('unableSaveSettings');
    } finally {
        showReopenButtonCheckbox.disabled = false;
    }
});

toggleCurrentButton.addEventListener('click', () => {
    if (!currentHost) {
        return;
    }

    const matchedRule = matchingRule(currentHost);
    const hosts = matchedRule
        ? excludedHosts.filter(host => host !== matchedRule)
        : [...excludedHosts, currentHost];
    saveHosts(hosts).catch(showError);
});

document.getElementById('manage-list').addEventListener('click', () => {
    extensionApi.tabs.create({ url: extensionApi.runtime.getURL('options.html') });
    window.close();
});

quickReportButton.addEventListener('click', () => openEmailReport(''));

describeReportButton.addEventListener('click', () => {
    reportFormElement.hidden = false;
    reportDescriptionElement.focus();
});

document.getElementById('send-report').addEventListener('click', () => {
    openEmailReport(reportDescriptionElement.value.trim());
});

document.getElementById('cancel-report').addEventListener('click', () => {
    reportFormElement.hidden = true;
    reportDescriptionElement.value = '';
});

extensionApi.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') {
        return;
    }

    if (changes[TOOLBAR_CLICK_ACTION_KEY]) {
        toolbarClickAction = changes[TOOLBAR_CLICK_ACTION_KEY].newValue === 'restore' ? 'restore' : 'popup';
        toolbarClickActionSelect.value = toolbarClickAction;
    }

    if (changes[SHOW_REOPEN_BUTTON_KEY]) {
        showReopenButtonCheckbox.checked = changes[SHOW_REOPEN_BUTTON_KEY].newValue === true;
    }

    if (changes[EXCLUDED_HOSTS_TEXT_KEY]) {
        excludedHostsText = typeof changes[EXCLUDED_HOSTS_TEXT_KEY].newValue === 'string'
            ? changes[EXCLUDED_HOSTS_TEXT_KEY].newValue
            : '';
    }

    if (changes[EXCLUDED_HOSTS_KEY]) {
        excludedHosts = Array.isArray(changes[EXCLUDED_HOSTS_KEY].newValue)
            ? changes[EXCLUDED_HOSTS_KEY].newValue
            : [];
    }

    render();
});

initialize().catch(showError);
