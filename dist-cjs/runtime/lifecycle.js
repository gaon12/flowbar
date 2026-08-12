"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateProgressBarId = allocateProgressBarId;
exports.onProgressBarClose = onProgressBarClose;
exports.notifyProgressBarClose = notifyProgressBarClose;
const closeListeners = new WeakMap();
let nextProgressBarId = 1;
function allocateProgressBarId() {
    const id = nextProgressBarId;
    nextProgressBarId += 1;
    return id;
}
function onProgressBarClose(bar, listener) {
    if (bar.closed) {
        listener();
        return () => { };
    }
    let listeners = closeListeners.get(bar);
    if (!listeners) {
        listeners = new Set();
        closeListeners.set(bar, listeners);
    }
    listeners.add(listener);
    return () => {
        listeners?.delete(listener);
    };
}
function notifyProgressBarClose(bar) {
    const listeners = closeListeners.get(bar);
    closeListeners.delete(bar);
    if (!listeners) {
        return;
    }
    for (const listener of listeners) {
        listener();
    }
}
