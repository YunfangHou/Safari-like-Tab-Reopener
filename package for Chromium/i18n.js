(() => {
    const api = typeof browser === 'undefined' ? chrome : browser;

    globalThis.localizeMessage = function (key, substitutions) {
        return api.i18n.getMessage(key, substitutions) || key;
    };

    document.documentElement.lang = api.i18n.getUILanguage().replace('_', '-');
    for (const element of document.querySelectorAll('[data-i18n]')) {
        element.textContent = globalThis.localizeMessage(element.dataset.i18n);
    }
})();
