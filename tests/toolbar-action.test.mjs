import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync('package for Chromium/background.js', 'utf8');

function createBackground(preference) {
    const listeners = {};
    const menus = [];
    const state = { preference, popup: 'popup.html', restores: 0, opens: [], warnings: [] };
    const event = name => ({ addListener(listener) { listeners[name] = listener; } });
    const chrome = {
        runtime: {
            onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message'),
            getURL: path => `chrome-extension://test/${path}`
        },
        storage: {
            local: {
                get: async () => ({ toolbarClickAction: state.preference }),
                set: async () => {}
            },
            onChanged: event('storage')
        },
        action: {
            onClicked: event('click'),
            setPopup: async ({ popup }) => { state.popup = popup; },
            setTitle: async ({ title }) => { state.title = title; },
            openPopup: async options => {
                assert.equal(state.popup, 'popup.html', 'settings must be bound before opening');
                state.opens.push({ ...options });
                await state.duringOpen?.();
            },
            setBadgeText() {}, setBadgeBackgroundColor() {}
        },
        contextMenus: {
            removeAll: callback => { menus.length = 0; callback(); },
            create: item => menus.push(item), onClicked: event('menu')
        },
        tabs: { onUpdated: event('tabUpdate'), create: details => { state.createdTab = details; } },
        sessions: { restore: async () => {
            state.restores++;
            if (state.restoreError) throw new Error('No session');
        } },
        i18n: { getMessage: key => key }
    };
    const context = vm.createContext({ chrome, console: {
        warn: (...args) => state.warnings.push(args), debug() {}
    } });
    vm.runInContext(source, context);
    const idle = () => vm.runInContext('toolbarTask', context);
    const change = value => {
        state.preference = value;
        listeners.storage({ toolbarClickAction: { newValue: value } }, 'local');
    };
    return { listeners, state, menus, idle, change };
}

test('toolbar defaults to popup and preserves the preference across worker and browser restarts', async () => {
    const background = createBackground();
    await background.idle();
    assert.equal(background.state.popup, 'popup.html');
    background.listeners.installed({ reason: 'update' });
    await background.idle();
    assert.deepEqual(background.menus.map(item => item.id), ['open-settings', 'open-excluded-websites']);
    assert.ok(background.menus.every(item => item.contexts[0] === 'action'));

    background.change('restore');
    await background.idle();
    assert.equal(background.state.popup, '');
    assert.equal(background.state.title, 'restoreToolbarTooltip');
    const restarted = createBackground('restore');
    await restarted.idle();
    assert.equal(restarted.state.popup, '', 'new worker restores saved behavior');
    restarted.state.popup = 'popup.html';
    restarted.listeners.startup();
    await restarted.idle();
    assert.equal(restarted.state.popup, '', 'browser startup restores saved behavior');

    background.change('popup');
    await background.idle();
    assert.equal(background.state.popup, 'popup.html');
    background.change('invalid');
    await background.idle();
    assert.equal(background.state.popup, 'popup.html', 'unknown preference falls back to settings');
});

test('right-click settings opens the real popup in both modes without changing left-click behavior', async () => {
    for (const preference of ['popup', 'restore']) {
        const { listeners, state, idle } = createBackground(preference);
        await idle();
        listeners.menu({ menuItemId: 'open-settings' }, { windowId: 17 });
        await idle();
        assert.deepEqual(state.opens, [{ windowId: 17 }]);
        assert.equal(state.popup, preference === 'restore' ? '' : 'popup.html');
        assert.equal(state.restores, 0, 'settings never restores a session');
        if (preference === 'restore') {
            listeners.click({ windowId: 17 });
            await idle();
            assert.equal(state.restores, 1, 'the next left-click still restores');
        }
        listeners.menu({ menuItemId: 'open-excluded-websites' }, { windowId: 17 });
        assert.equal(state.createdTab.url, 'chrome-extension://test/options.html');
    }
});

test('popup failures and changes made while opening cannot leave a temporary binding behind', async () => {
    const { listeners, state, idle, change } = createBackground('restore');
    await idle();
    state.duringOpen = async () => { throw new Error('Popup unavailable'); };
    listeners.menu({ menuItemId: 'open-settings' });
    await idle();
    assert.equal(state.popup, '');
    assert.equal(state.warnings.length, 1);

    state.duringOpen = async () => { change('popup'); };
    listeners.menu({ menuItemId: 'open-settings' }, { windowId: 17 });
    await idle();
    await idle();
    assert.equal(state.popup, 'popup.html', 'opening cleanup uses the latest preference');
    state.duringOpen = async () => { change('restore'); };
    listeners.menu({ menuItemId: 'open-settings' }, { windowId: 17 });
    await idle();
    await idle();
    assert.equal(state.popup, '');
});

test('toolbar handles empty restore history and acknowledges settings only after applying them', async () => {
    const { listeners, state, idle, change } = createBackground('restore');
    await idle();
    state.restoreError = true;
    listeners.click({ windowId: 1 });
    await idle();
    assert.equal(state.restores, 1);
    assert.equal(state.warnings.length, 0);
    change('popup');
    let response;
    const keepAlive = listeners.message({ command: 'apply_toolbar_click_action' }, {}, value => {
        response = value;
        assert.equal(state.popup, 'popup.html');
    });
    assert.equal(keepAlive, true);
    await idle();
    assert.equal(response.ok, true);
});
