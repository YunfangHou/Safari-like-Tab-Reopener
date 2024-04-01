document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        if (!(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            event.preventDefault();
            chrome.runtime.sendMessage({command: "reopen_last_tab"});
        }
    }
});
