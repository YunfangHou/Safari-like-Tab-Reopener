const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const EXCLUDED_HOSTS_KEY = 'excludedHosts';
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
    const result = await extensionApi.storage.local.get(EXCLUDED_HOSTS_KEY);
    const hosts = Array.isArray(result[EXCLUDED_HOSTS_KEY]) ? result[EXCLUDED_HOSTS_KEY] : [];
    textarea.value = hosts.join('\n');
}

extensionApi.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'local' && changes[EXCLUDED_HOSTS_KEY]) {
        const hosts = Array.isArray(changes[EXCLUDED_HOSTS_KEY].newValue)
            ? changes[EXCLUDED_HOSTS_KEY].newValue
            : [];
        textarea.value = hosts.join('\n');
    }
});

async function saveOptions() {
    const lines = textarea.value.split(/\r?\n/);
    const invalidLines = lines.filter(line => line.trim() && !normalizeHost(line));

    if (invalidLines.length > 0) {
        status.textContent = `Not saved: invalid entry “${invalidLines[0].trim()}”.`;
        status.className = 'error';
        return;
    }

    const hosts = [...new Set(lines.map(normalizeHost).filter(Boolean))].sort();
    await extensionApi.storage.local.set({ [EXCLUDED_HOSTS_KEY]: hosts });
    textarea.value = hosts.join('\n');
    status.textContent = `Saved ${hosts.length} excluded website${hosts.length === 1 ? '' : 's'}.`;
    status.className = 'success';
}

document.getElementById('save').addEventListener('click', () => {
    saveOptions().catch(() => {
        status.textContent = 'Unable to save the exclusion list.';
        status.className = 'error';
    });
});

restoreOptions().catch(() => {
    status.textContent = 'Unable to load the exclusion list.';
    status.className = 'error';
});
