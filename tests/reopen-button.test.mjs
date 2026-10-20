import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

async function setup(kind, stored = {}) {
    const messages = [];
    const saves = [];
    const hosts = [];
    const windowListeners = {};
    let storageListener;

    function element(tag) {
        const listeners = {};
        const captured = new Set();
        return {
            tag,
            children: [],
            attributes: {},
            style: { setProperty(key, value) { this[key] = value; } },
            append(...children) { this.children.push(...children); },
            attachShadow({ mode }) { this.shadowMode = mode; return this.shadow = element('shadow'); },
            setAttribute(key, value) { this.attributes[key] = value; },
            addEventListener(name, listener) { listeners[name] = listener; },
            setPointerCapture(id) { captured.add(id); },
            hasPointerCapture(id) { return captured.has(id); },
            releasePointerCapture(id) { captured.delete(id); },
            getBoundingClientRect() {
                return { left: parseFloat(this.style.left), top: parseFloat(this.style.top) };
            },
            remove() { hosts.splice(hosts.indexOf(this), 1); },
            fire(name, overrides = {}) {
                listeners[name]({
                    pointerId: 1, button: 0, isPrimary: true,
                    clientX: 20, clientY: 750, detail: 1,
                    stopPropagation() {}, ...overrides
                });
            }
        };
    }

    const api = {
        storage: {
            local: {
                get: async () => stored,
                set: async value => { saves.push(value); }
            },
            onChanged: { addListener(listener) { storageListener = listener; } }
        },
        runtime: { sendMessage(message) { messages.push(message); } },
        i18n: { getMessage: key => key }
    };
    const context = {
        [kind === 'Firefox' ? 'browser' : 'chrome']: api,
        document: {
            createElement: element,
            createElementNS: (namespace, tag) => element(tag),
            documentElement: { append(host) { hosts.push(host); } }
        },
        window: {
            innerWidth: 1000,
            innerHeight: 800,
            addEventListener(name, listener) { windowListeners[name] = listener; }
        }
    };
    vm.runInNewContext(readFileSync(`package for ${kind}/reopen-button.js`, 'utf8'), context);
    await Promise.resolve();
    return {
        hosts, messages, saves, context,
        get host() { return hosts[0]; },
        get button() { return hosts[0].shadow.children[1]; },
        change(changes, area = 'local') { storageListener(changes, area); },
        resize(width, height) {
            context.window.innerWidth = width;
            context.window.innerHeight = height;
            windowListeners.resize();
        }
    };
}

test('floating button is opt-in and responds to settings on existing pages', async () => {
    for (const kind of ['Chromium', 'Firefox']) {
        const page = await setup(kind);
        assert.equal(page.hosts.length, 0, 'hidden when preference is absent');
        page.change({ showReopenButton: { newValue: true } }, 'sync');
        assert.equal(page.hosts.length, 0, 'only local settings apply');
        page.change({ showReopenButton: { newValue: true } });
        assert.equal(page.hosts.length, 1);
        assert.equal(page.host.style.left, '16px');
        assert.equal(page.host.style.top, '740px');
        assert.equal(page.host.shadowMode, 'open', 'button styles use a separate shadow tree');
        assert.equal(page.button.attributes['aria-label'], 'reopenLastTabCommand');
        page.change({ showReopenButton: { newValue: true } });
        assert.equal(page.hosts.length, 1, 'does not duplicate the button');
        page.button.fire('click');
        assert.deepEqual({ ...page.messages.pop() }, { command: 'reopen_last_tab' });
        page.change({ showReopenButton: { newValue: false } });
        assert.equal(page.hosts.length, 0);
    }
});

test('dragging clamps and saves position without reopening a tab', async () => {
    for (const kind of ['Chromium', 'Firefox']) {
        const page = await setup(kind, { showReopenButton: true });
        page.button.fire('pointerdown');
        page.button.fire('pointermove', { clientX: 2000, clientY: -100 });
        assert.equal(page.host.style.left, '956px');
        assert.equal(page.host.style.top, '0px');
        page.button.fire('pointerup');
        page.button.fire('click');
        assert.equal(page.messages.length, 0, 'drag-generated click is suppressed');
        const saved = page.saves.pop();
        assert.deepEqual({ ...saved.reopenButtonPosition }, { x: 1, y: 0 });

        const nextPage = await setup(kind, { showReopenButton: true, ...saved });
        assert.equal(nextPage.host.style.left, '956px');
        nextPage.resize(500, 400);
        assert.equal(nextPage.host.style.left, '456px', 'position follows viewport size');
        nextPage.change({ reopenButtonPosition: { newValue: { x: 0.5, y: 0.5 } } });
        assert.equal(nextPage.host.style.left, '228px');
        assert.equal(nextPage.host.style.top, '178px');
        nextPage.resize(30, 30);
        assert.equal(nextPage.host.style.left, '0px');
        assert.equal(nextPage.host.style.top, '0px');

        page.button.fire('pointerdown');
        page.button.fire('pointermove', { clientX: 22, clientY: 752 });
        page.button.fire('pointerup');
        page.button.fire('click');
        assert.equal(page.messages.length, 1, 'small pointer movement remains a click');
        assert.equal(page.saves.length, 0);
    }
});

test('cancelled drags restore the position and keep keyboard activation available', async () => {
    for (const kind of ['Chromium', 'Firefox']) {
        const page = await setup(kind, {
            showReopenButton: true,
            reopenButtonPosition: { x: NaN, y: 0.5 }
        });
        page.button.fire('pointerdown');
        page.button.fire('pointermove', { clientX: 200, clientY: 300 });
        page.button.fire('pointercancel');
        assert.equal(page.host.style.left, '16px');
        assert.equal(page.host.style.top, '740px');
        assert.equal(page.saves.length, 0);
        page.button.fire('click', { detail: 0 });
        assert.equal(page.messages.length, 1, 'keyboard click works after cancelling a drag');
    }
});
