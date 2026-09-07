import type { ProgressBar } from "./progress-bar.js";

const closeListeners = new WeakMap<ProgressBar, Set<() => void>>();
let nextProgressBarId = 1;

export function allocateProgressBarId(): number {
  const id = nextProgressBarId;
  nextProgressBarId += 1;
  return id;
}

export function onProgressBarClose(bar: ProgressBar, listener: () => void): () => void {
  if (bar.closed) {
    listener();
    return () => {};
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

export function notifyProgressBarClose(bar: ProgressBar): void {
  const listeners = closeListeners.get(bar);
  closeListeners.delete(bar);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener();
  }
}
