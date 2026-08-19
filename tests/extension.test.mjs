import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const packageKinds = ['Chromium', 'Firefox'];

function source(kind, file) {
    return readFileSync(`package for ${kind}/${file}`, 'utf8');
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
}

function plainElement() {
    return {
        nodeType: 1,
        isContentEditable: false,
        matches: () => false,
        closest: () => null
    };
}

test('content scripts respect exclusions and editable Shadow DOM contexts', async () => {
    for (const kind of packageKinds) {
        let keydown;
        let storageListener;
        const messages = [];
        const plain = plainElement();
        const shadowEditor = {
            ...plainElement(),
            matches: selector => selector.includes('[role="textbox"]')
        };
        const context = {
            Node: { ELEMENT_NODE: 1 },
            location: { hostname: 'editor.example.com', pathname: '/' },
            document: {
                designMode: 'off',
                activeElement: plain,
                addEventListener(name, listener) {
                    if (name === 'keydown') keydown = listener;
                }
            },
            chrome: {
                storage: {
                    local: { get: async () => ({ excludedHosts: ['example.com'] }) },
                    onChanged: { addListener(listener) { storageListener = listener; } }
                },
                runtime: { sendMessage(message) { messages.push(message); } }
            }
        };
        vm.runInNewContext(source(kind, 'content.js'), context);
        await flushPromises();
        assert.deepEqual({ ...messages.pop() }, { command: 'set_exclusion_state', excluded: true });

        let prevented = false;
        const press = overrides => {
            prevented = false;
            keydown({
                ctrlKey: true,
                metaKey: false,
                shiftKey: false,
                altKey: false,
                key: 'z',
                code: 'KeyZ',
                target: plain,
                defaultPrevented: false,
                isComposing: false,
                composedPath: () => [plain],
                preventDefault: () => { prevented = true; },
                ...overrides
            });
            return prevented;
        };

        assert.equal(press({}), false, 'excluded website');
        storageListener({ excludedHosts: { newValue: [] } }, 'local');
        assert.equal(press({}), true, 'ordinary website');
        assert.equal(press({ ctrlKey: false, metaKey: true }), true, 'Command+Z');
        assert.equal(press({ shiftKey: true }), false, 'Ctrl+Shift+Z');
        assert.equal(press({ altKey: true }), false, 'Ctrl+Alt+Z');
        assert.equal(press({ metaKey: true }), false, 'Ctrl+Command+Z');
        assert.equal(press({ composedPath: () => [plain, shadowEditor] }), false, 'Shadow DOM editor');
        assert.equal(press({ isComposing: true }), false, 'IME composition');
    }
});

test('background scripts update per-tab badges', () => {
    for (const kind of packageKinds) {
        const isChromium = kind === 'Chromium';
        const apiName = isChromium ? 'chrome' : 'browser';
        const actionName = isChromium ? 'action' : 'browserAction';
        let messageListener;
        let updatedListener;
        const badgeUpdates = [];
        const api = {
            runtime: {
                onInstalled: { addListener() {} },
                onMessage: { addListener(listener) { messageListener = listener; } },
                getURL: path => path
            },
            contextMenus: {
                removeAll: isChromium ? callback => callback() : async () => {},
                create() {},
                onClicked: { addListener() {} }
            },
            tabs: {
                create() {},
                onUpdated: { addListener(listener) { updatedListener = listener; } }
            },
            sessions: { restore() {} },
            i18n: { getMessage: key => key === 'badgeOff' ? 'OFF' : 'Excluded websites' },
            [actionName]: {
                setBadgeText(details) { badgeUpdates.push(details); },
                setBadgeBackgroundColor() {}
            }
        };
        vm.runInNewContext(source(kind, 'background.js'), { [apiName]: api });

        messageListener({ command: 'set_exclusion_state', excluded: true }, { tab: { id: 7 } });
        assert.deepEqual({ ...badgeUpdates.pop() }, { tabId: 7, text: 'OFF' });
        updatedListener(7, { status: 'loading' });
        assert.deepEqual({ ...badgeUpdates.pop() }, { tabId: 7, text: '' });
    }
});

test('options normalize hosts and react to shared storage changes', async () => {
    for (const kind of packageKinds) {
        let storageListener;
        let saved;
        const textarea = { value: '' };
        const status = { textContent: '', className: '' };
        const saveButton = { addEventListener() {} };
        const context = {
            URL,
            localizeMessage: (key, value) => `${key}:${value ?? ''}`,
            document: {
                getElementById: id => id === 'excluded-hosts' ? textarea : id === 'status' ? status : saveButton
            },
            chrome: {
                storage: {
                    local: {
                        get: async () => ({ excludedHosts: [] }),
                        set: async value => { saved = value; }
                    },
                    onChanged: { addListener(listener) { storageListener = listener; } }
                }
            }
        };
        vm.runInNewContext(source(kind, 'options.js'), context);
        await flushPromises();
        assert.equal(context.normalizeHost('HTTPS://*.Editor.Example.COM/path'), 'editor.example.com');
        assert.equal(context.normalizeHost('not a host'), null);

        textarea.value = 'Example.com\nhttps://sub.example.org/path\nexample.com';
        await context.saveOptions();
        assert.deepEqual(Array.from(saved.excludedHosts), ['example.com', 'sub.example.org']);

        storageListener({ excludedHosts: { newValue: ['synced.example'] } }, 'local');
        assert.equal(textarea.value, 'synced.example');
    }
});

test('popup adds the active website and stays synchronized', async () => {
    for (const kind of packageKinds) {
        const listeners = {};
        let storageListener;
        let saved;
        const openedUrls = [];
        const elements = new Map();

        function element(id) {
            if (!elements.has(id)) {
                elements.set(id, {
                    id,
                    textContent: '',
                    disabled: false,
                    hidden: false,
                    children: [],
                    addEventListener(name, listener) { listeners[`${id}:${name}`] = listener; },
                    replaceChildren() { this.children = []; },
                    append(...children) { this.children.push(...children); },
                    setAttribute() {},
                    focus() { this.focused = true; }
                });
            }
            return elements.get(id);
        }

        const context = {
            URL,
            localizeMessage: (key, value) => value ? `${key}:${value}` : key,
            document: {
                getElementById: element,
                createElement: tag => ({
                    tag,
                    textContent: '',
                    children: [],
                    addEventListener() {},
                    append(...children) { this.children.push(...children); },
                    setAttribute() {}
                })
            },
            window: { close() {} },
            chrome: {
                tabs: {
                    query: async () => [{ url: 'https://editor.example.com/project' }],
                    create({ url }) { openedUrls.push(url); }
                },
                storage: {
                    local: {
                        get: async () => ({ excludedHosts: ['existing.example'] }),
                        set: async value => { saved = value; }
                    },
                    onChanged: { addListener(listener) { storageListener = listener; } }
                },
                runtime: { getURL: path => path }
            }
        };
        vm.runInNewContext(source(kind, 'popup.js'), context);
        await flushPromises();

        assert.equal(element('current-host').textContent, 'editor.example.com');
        listeners['toggle-current:click']();
        await flushPromises();
        assert.deepEqual(Array.from(saved.excludedHosts), ['editor.example.com', 'existing.example']);

        storageListener({ excludedHosts: { newValue: ['example.com'] } }, 'local');
        assert.equal(element('toggle-current').textContent, 'removeFromExclusions:example.com');

        listeners['quick-report:click']();
        const quickReport = new URL(openedUrls.pop());
        assert.equal(quickReport.pathname, 'Yunfang.Hou2001@gmail.com');
        assert.equal(quickReport.searchParams.get('body'), 'reportedWebsite: https://editor.example.com/project');

        listeners['describe-report:click']();
        assert.equal(element('report-form').hidden, false);
        assert.equal(element('report-description').focused, true);
        element('report-description').value = 'Undo reopened a tab while editing.';
        listeners['send-report:click']();
        const detailedReport = new URL(openedUrls.pop());
        assert.match(detailedReport.searchParams.get('body'), /issueDescription:\nUndo reopened a tab while editing\.$/);
    }
});

test('localization helper translates marked elements', () => {
    for (const kind of packageKinds) {
        const nodes = [
            { dataset: { i18n: 'excludedWebsites' }, textContent: '' },
            { dataset: { i18n: 'save' }, textContent: '' }
        ];
        const placeholder = { dataset: { i18nPlaceholder: 'issueDescriptionPlaceholder' }, placeholder: '' };
        const context = {
            document: {
                documentElement: { lang: 'en' },
                querySelectorAll: selector => selector === '[data-i18n]' ? nodes : [placeholder]
            },
            chrome: {
                i18n: {
                    getUILanguage: () => 'zh_CN',
                    getMessage: key => ({
                        excludedWebsites: '排除的网站',
                        save: '保存',
                        issueDescriptionPlaceholder: '请描述问题…'
                    })[key] || ''
                }
            }
        };
        context.globalThis = context;
        vm.runInNewContext(source(kind, 'i18n.js'), context);
        assert.equal(context.document.documentElement.lang, 'zh-CN');
        assert.deepEqual(nodes.map(node => node.textContent), ['排除的网站', '保存']);
        assert.equal(placeholder.placeholder, '请描述问题…');
    }
});
