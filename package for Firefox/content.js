const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const EXCLUDED_HOSTS_KEY = 'excludedHosts';

let excludedHosts = [];
let exclusionListReady = false;

function setExcludedHosts(hosts) {
    excludedHosts = Array.isArray(hosts)
        ? hosts.filter(host => typeof host === 'string' && host.length > 0)
        : [];
    exclusionListReady = true;
}

extensionApi.storage.local.get(EXCLUDED_HOSTS_KEY)
    .then(result => setExcludedHosts(result[EXCLUDED_HOSTS_KEY]))
    .catch(() => setExcludedHosts([]));

extensionApi.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'local' && changes[EXCLUDED_HOSTS_KEY]) {
        setExcludedHosts(changes[EXCLUDED_HOSTS_KEY].newValue);
    }
});

function isGoogleSheetsPage() {
    return location.hostname === 'docs.google.com' &&
        location.pathname.startsWith('/spreadsheets/');
}

function isEditableElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    return element.matches('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') ||
        Boolean(element.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

function isUndoShortcut(event) {
    const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

    // `key` follows the active keyboard layout, while `code` identifies the
    // physical Z key (for example, it produces "я" on a Russian layout).
    return (event.ctrlKey || event.metaKey) &&
        (event.code === 'KeyZ' || key === 'z');
}

function isExcludedPage() {
    const hostname = location.hostname.toLowerCase();

    return excludedHosts.some(excludedHost =>
        hostname === excludedHost || hostname.endsWith(`.${excludedHost}`)
    );
}

document.addEventListener('keydown', function (event) {
    if (!isUndoShortcut(event)) {
        return;
    }

    // Google Sheets implements its own undo history even when the focused cell
    // is not represented by a text-editing element in the page DOM.
    if (!exclusionListReady || isGoogleSheetsPage() || isExcludedPage() || event.defaultPrevented || isEditableElement(event.target) || isEditableElement(document.activeElement)) {
        return;
    }

    event.preventDefault();
    extensionApi.runtime.sendMessage({ command: "reopen_last_tab" });
});
