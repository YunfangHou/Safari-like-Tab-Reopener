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

document.addEventListener('keydown', function (event) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') {
        return;
    }

    // Google Sheets implements its own undo history even when the focused cell
    // is not represented by a text-editing element in the page DOM.
    if (isGoogleSheetsPage() || event.defaultPrevented || isEditableElement(event.target) || isEditableElement(document.activeElement)) {
        return;
    }

    event.preventDefault();
    chrome.runtime.sendMessage({ command: "reopen_last_tab" });
});
