const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const EXCLUDED_HOSTS_KEY = 'excludedHosts';
const EXCLUDED_HOSTS_TEXT_KEY = 'excludedHostsText';
const textarea = document.getElementById('excluded-hosts');
const status = document.getElementById('status');

function normalizeHost(value) {
    let input = value.trim().toLowerCase();
    if (!input) {
        return null;
    }

    input = input.replace(/^([a-z][a-z\d+.-]*:\/\/)?\*\./, '$1');

    try {
        const url = new URL(input.includes('://') ? input : `https://${input}`);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }

        return url.hostname.replace(/\.$/, '') || null;
    } catch (error) {
        return null;
    }
}

async function restoreOptions() {
    const result = await extensionApi.storage.local.get([EXCLUDED_HOSTS_KEY, EXCLUDED_HOSTS_TEXT_KEY]);
    const hosts = Array.isArray(result[EXCLUDED_HOSTS_KEY]) ? result[EXCLUDED_HOSTS_KEY] : [];
    textarea.value = typeof result[EXCLUDED_HOSTS_TEXT_KEY] === 'string'
        ? result[EXCLUDED_HOSTS_TEXT_KEY]
        : hosts.join('\n');
}

extensionApi.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') {
        return;
    }

    if (changes[EXCLUDED_HOSTS_TEXT_KEY]) {
        textarea.value = typeof changes[EXCLUDED_HOSTS_TEXT_KEY].newValue === 'string'
            ? changes[EXCLUDED_HOSTS_TEXT_KEY].newValue
            : '';
    } else if (changes[EXCLUDED_HOSTS_KEY]) {
        const hosts = Array.isArray(changes[EXCLUDED_HOSTS_KEY].newValue)
            ? changes[EXCLUDED_HOSTS_KEY].newValue
            : [];
        textarea.value = hosts.join('\n');
    }
});

async function saveOptions() {
    const lines = textarea.value.split(/\r?\n/);
    const hosts = [];
    const normalizedLines = [];
    const seenHosts = new Set();
    let invalidLine = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            if (normalizedLines.length > 0 && normalizedLines.at(-1) !== '') {
                normalizedLines.push('');
            }
            continue;
        }

        if (trimmed.startsWith('#')) {
            normalizedLines.push(trimmed);
            continue;
        }

        const host = normalizeHost(trimmed);
        if (!host) {
            invalidLine = trimmed;
            break;
        }

        if (!seenHosts.has(host)) {
            seenHosts.add(host);
            hosts.push(host);
            normalizedLines.push(host);
        }
    }

    if (invalidLine) {
        status.textContent = localizeMessage('invalidEntry', invalidLine);
        status.className = 'error';
        return;
    }

    while (normalizedLines.at(-1) === '') {
        normalizedLines.pop();
    }

    const normalizedText = normalizedLines.join('\n');
    await extensionApi.storage.local.set({
        [EXCLUDED_HOSTS_KEY]: hosts,
        [EXCLUDED_HOSTS_TEXT_KEY]: normalizedText
    });
    textarea.value = normalizedText;
    status.textContent = localizeMessage(hosts.length === 1 ? 'savedOne' : 'savedMany', String(hosts.length));
    status.className = 'success';
}

document.getElementById('save').addEventListener('click', () => {
    saveOptions().catch(() => {
        status.textContent = localizeMessage('unableSaveList');
        status.className = 'error';
    });
});

restoreOptions().catch(() => {
    status.textContent = localizeMessage('unableLoadList');
    status.className = 'error';
});
