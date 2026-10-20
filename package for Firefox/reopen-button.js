(() => {
    const extensionApi = typeof browser === 'undefined' ? chrome : browser;
    const SHOW_BUTTON_KEY = 'showReopenButton';
    const POSITION_KEY = 'reopenButtonPosition';
    const SIZE = 44;
    const MARGIN = 16;
    let host;
    let button;
    let position = null;
    let drag = null;
    let suppressClick = false;

    function bounds() {
        return {
            x: Math.max(0, window.innerWidth - SIZE),
            y: Math.max(0, window.innerHeight - SIZE)
        };
    }

    function validPosition(value) {
        return value && Number.isFinite(value.x) && Number.isFinite(value.y)
            ? { x: Math.min(1, Math.max(0, value.x)), y: Math.min(1, Math.max(0, value.y)) }
            : null;
    }

    function placeButton() {
        if (!host) return;
        const available = bounds();
        const x = position ? position.x * available.x : Math.min(MARGIN, available.x);
        const y = position ? position.y * available.y : Math.max(0, available.y - MARGIN);
        host.style.setProperty('left', `${x}px`, 'important');
        host.style.setProperty('top', `${y}px`, 'important');
    }

    function finishDrag(event, cancelled = false) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.stopPropagation();
        const moved = drag.moved;
        drag = null;
        if (button.hasPointerCapture(event.pointerId)) {
            button.releasePointerCapture(event.pointerId);
        }
        suppressClick = moved;
        if (cancelled) {
            placeButton();
            return;
        }
        if (moved) {
            const available = bounds();
            const rect = host.getBoundingClientRect();
            position = validPosition({
                x: available.x ? rect.left / available.x : 0,
                y: available.y ? rect.top / available.y : 0
            });
            placeButton();
            extensionApi.storage.local.set({ [POSITION_KEY]: position }).catch(() => {});
        }
    }

    function setVisible(visible) {
        if (!visible) {
            host?.remove();
            host = null;
            button = null;
            drag = null;
            return;
        }
        if (host) return;

        host = document.createElement('div');
        host.style.cssText = 'all: initial !important; position: fixed !important; width: 44px !important; height: 44px !important; z-index: 2147483647 !important;';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            button {
                all: initial;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border: 1px solid rgba(255, 255, 255, .65);
                border-radius: 50%;
                background: #1769e0;
                color: white;
                box-shadow: 0 2px 10px rgba(0, 0, 0, .25);
                font: 30px/1 system-ui, sans-serif;
                cursor: grab;
                touch-action: none;
                user-select: none;
            }
            button:hover { background: #1256bc; }
            button:active { cursor: grabbing; }
            button:focus-visible { outline: 3px solid #1769e0; outline-offset: 3px; }
        `;
        button = document.createElement('button');
        button.type = 'button';
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        for (const [name, value] of Object.entries({
            viewBox: '0 0 24 24', width: '24', height: '24',
            fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            'aria-hidden': 'true', focusable: 'false'
        })) {
            icon.setAttribute(name, value);
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-2');
        icon.append(path);
        button.append(icon);
        button.title = extensionApi.i18n.getMessage('reopenButtonTooltip');
        button.setAttribute('aria-label', extensionApi.i18n.getMessage('reopenLastTabCommand'));
        button.addEventListener('click', event => {
            event.stopPropagation();
            if (suppressClick && event.detail !== 0) {
                suppressClick = false;
                return;
            }
            suppressClick = false;
            extensionApi.runtime.sendMessage({ command: 'reopen_last_tab' });
        });
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.isPrimary === false) return;
            event.stopPropagation();
            suppressClick = false;
            const rect = host.getBoundingClientRect();
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                left: rect.left,
                top: rect.top,
                moved: false
            };
            button.setPointerCapture(event.pointerId);
        });
        button.addEventListener('pointermove', event => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            event.stopPropagation();
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.moved && Math.hypot(dx, dy) < 5) return;
            drag.moved = true;
            const available = bounds();
            host.style.setProperty('left', `${Math.min(available.x, Math.max(0, drag.left + dx))}px`, 'important');
            host.style.setProperty('top', `${Math.min(available.y, Math.max(0, drag.top + dy))}px`, 'important');
        });
        button.addEventListener('pointerup', event => finishDrag(event));
        button.addEventListener('pointercancel', event => finishDrag(event, true));
        button.addEventListener('lostpointercapture', event => finishDrag(event, true));
        shadow.append(style, button);
        document.documentElement.append(host);
        placeButton();
    }

    extensionApi.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes[POSITION_KEY]) {
            position = validPosition(changes[POSITION_KEY].newValue);
            if (!drag) placeButton();
        }
        if (changes[SHOW_BUTTON_KEY]) {
            setVisible(changes[SHOW_BUTTON_KEY].newValue === true);
        }
    });

    window.addEventListener('resize', () => {
        if (!drag) placeButton();
    });

    extensionApi.storage.local.get([SHOW_BUTTON_KEY, POSITION_KEY]).then(stored => {
        position = validPosition(stored[POSITION_KEY]);
        setVisible(stored[SHOW_BUTTON_KEY] === true);
    }).catch(() => {});
})();
