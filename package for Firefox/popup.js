const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const EXCLUDED_HOSTS_KEY = 'excludedHosts';

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
let currentPageUrl = null;
let excludedHosts = [];

function matchingRule(hostname) {
    return excludedHosts.find(host =>
        hostname === host || hostname.endsWith(`.${host}`)
    );
}

async function saveHosts(hosts) {
    excludedHosts = [...new Set(hosts)].sort();
    await extensionApi.storage.local.set({ [EXCLUDED_HOSTS_KEY]: excludedHosts });
    render();
}

function render() {
    const matchedRule = currentHost ? matchingRule(currentHost) : null;

    currentHostElement.textContent = currentHost || localizeMessage('thisPageCannotBeExcluded');
    toggleCurrentButton.disabled = !currentHost;
    quickReportButton.disabled = !currentPageUrl;
    describeReportButton.disabled = !currentPageUrl;
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
    if (!currentPageUrl) {
        return;
    }

    const bodyLines = [`${localizeMessage('reportedWebsite')}: ${currentPageUrl}`];
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
    const stored = await extensionApi.storage.local.get(EXCLUDED_HOSTS_KEY);
    excludedHosts = Array.isArray(stored[EXCLUDED_HOSTS_KEY]) ? stored[EXCLUDED_HOSTS_KEY] : [];

    try {
        const url = new URL(tab.url);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            currentHost = url.hostname.toLowerCase();
            currentPageUrl = url.href;
        }
    } catch (error) {
        currentHost = null;
    }

    render();
}

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
    if (areaName === 'local' && changes[EXCLUDED_HOSTS_KEY]) {
        excludedHosts = Array.isArray(changes[EXCLUDED_HOSTS_KEY].newValue)
            ? changes[EXCLUDED_HOSTS_KEY].newValue
            : [];
        render();
    }
});

initialize().catch(showError);
