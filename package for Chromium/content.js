const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const EXCLUDED_HOSTS_KEY = 'excludedHosts';

let excludedHosts = [];
let exclusionListReady = false;

function setExcludedHosts(hosts) {
    excludedHosts = Array.isArray(hosts)
        ? hosts.filter(host => typeof host === 'string' && host.length > 0)
        : [];
    exclusionListReady = true;
    reportExclusionState();
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

    const editableSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]';

    return element.isContentEditable ||
        element.matches(editableSelector) ||
        Boolean(element.closest(editableSelector));
}

function isEditableContext(event) {
    if (event.isComposing || document.designMode.toLowerCase() === 'on') {
        return true;
    }

    const eventPath = typeof event.composedPath === 'function'
        ? event.composedPath()
        : [event.target];

    return eventPath.some(isEditableElement) || isEditableElement(document.activeElement);
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

function reportExclusionState() {
    if (!exclusionListReady) {
        return;
    }

    extensionApi.runtime.sendMessage({
        command: 'set_exclusion_state',
        excluded: isGoogleSheetsPage() || isExcludedPage()
    });
}

document.addEventListener('keydown', function (event) {
    if (!isUndoShortcut(event)) {
        return;
    }

    // Google Sheets implements its own undo history even when the focused cell
    // is not represented by a text-editing element in the page DOM.
    if (!exclusionListReady || isGoogleSheetsPage() || isExcludedPage() || event.defaultPrevented || isEditableContext(event)) {
        return;
    }

    event.preventDefault();
    extensionApi.runtime.sendMessage({ command: "reopen_last_tab" });
});
