import { normalizeMode, normalizeOptions } from "./options.js";
import { createRenderer } from "./renderers.js";
import { assertFiniteNumber, normalizeNonNegativeNumber, normalizeOptionalNonNegativeNumber, now, safeMessage, } from "./utils.js";
export let nextProgressBarId = 1;
export class ProgressBar {
    id;
    normalizedOptions;
    currentValue;
    totalValue;
    statusValue;
    postfixValue;
    startedAtValue;
    updatedAtValue;
    lastRateAt;
    ratePerSecond;
    frameIndexValue;
    closedValue;
    finishState = "closed";
    finishMessage = "";
    renderer;
    closeListeners;
    abortHandler;
    animationTimer;
    constructor(options = {}) {
        this.id = nextProgressBarId;
        nextProgressBarId += 1;
        this.normalizedOptions = normalizeOptions(options);
        this.currentValue =
            normalizeOptionalNonNegativeNumber(this.normalizedOptions.current, "current") ?? 0;
        this.totalValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.total, "total");
        this.statusValue = this.normalizedOptions.status;
        this.postfixValue = { ...(this.normalizedOptions.postfix || {}) };
        this.startedAtValue = now();
        this.updatedAtValue = this.startedAtValue;
        this.lastRateAt = this.startedAtValue;
        this.ratePerSecond = null;
        this.frameIndexValue = 0;
        this.closedValue = false;
        this.renderer = createRenderer(this.normalizedOptions);
        this.closeListeners = new Set();
        this.abortHandler = undefined;
        this.animationTimer = undefined;
        if (this.normalizedOptions.signal) {
            this.abortHandler = () => {
                this.cancel("aborted");
            };
            if (this.normalizedOptions.signal.aborted) {
                this.cancel("aborted");
                return;
            }
            this.normalizedOptions.signal.addEventListener("abort", this.abortHandler, { once: true });
        }
        try {
            this.renderer.register(this);
            this.syncAnimationTimer();
        }
        catch (error) {
            this.closedValue = true;
            if (this.abortHandler)
                this.normalizedOptions.signal?.removeEventListener("abort", this.abortHandler);
            try {
                this.renderer.finalize(this, "closed", "", false);
            }
            finally {
                this.renderer.dispose();
            }
            throw error;
        }
    }
    get options() {
        const spinnerFrames = this.normalizedOptions.spinnerFrames
            ? this.normalizedOptions.spinnerFrames.slice()
            : undefined;
        return { ...this.normalizedOptions, spinnerFrames };
    }
    get current() {
        return this.currentValue;
    }
    get total() {
        return this.totalValue;
    }
    get status() {
        return this.statusValue;
    }
    get label() {
        return this.normalizedOptions.label;
    }
    get postfix() {
        return { ...this.postfixValue };
    }
    get startedAt() {
        return this.startedAtValue;
    }
    get updatedAt() {
        return this.updatedAtValue;
    }
    get frameIndex() {
        return this.frameIndexValue;
    }
    get closed() {
        return this.closedValue;
    }
    getMode() {
        if (this.normalizedOptions.mode && this.normalizedOptions.mode !== "auto") {
            return this.normalizedOptions.mode;
        }
        if (this.totalValue != null) {
            return "determinate";
        }
        if (this.currentValue > 0) {
            return "counting";
        }
        return "indeterminate";
    }
    snapshot() {
        const currentTime = this.closedValue ? this.updatedAtValue : now();
        const elapsedMs = Math.max(0, currentTime - this.startedAtValue);
        const rate = this.ratePerSecond ??
            (elapsedMs > 0 && this.currentValue > 0 ? this.currentValue / (elapsedMs / 1000) : null);
        const remainingMs = this.totalValue != null &&
            rate != null &&
            rate > 0 &&
            elapsedMs >= this.normalizedOptions.minElapsedMsForEta
            ? Math.max(0, (this.totalValue - this.currentValue) / rate) * 1000
            : null;
        return {
            id: this.id,
            current: this.currentValue,
            total: this.totalValue,
            mode: this.getMode(),
            status: this.statusValue,
            postfix: { ...this.postfixValue },
            frameIndex: this.frameIndexValue,
            options: this.options,
            timing: {
                startedAt: this.startedAtValue,
                updatedAt: this.updatedAtValue,
                elapsedMs,
                remainingMs,
                etaAt: remainingMs == null ? null : Date.now() + remainingMs,
                ratePerSecond: rate,
            },
        };
    }
    updateRate(previousValue, nextValue) {
        const currentTime = now();
        const elapsedSeconds = (currentTime - this.lastRateAt) / 1000;
        const delta = nextValue - previousValue;
        if (elapsedSeconds > 0 && delta !== 0) {
            const instantRate = delta / elapsedSeconds;
            if (instantRate > 0) {
                if (this.ratePerSecond == null) {
                    this.ratePerSecond = instantRate;
                }
                else {
                    const smoothing = this.normalizedOptions.rateSmoothing;
                    this.ratePerSecond = this.ratePerSecond * smoothing + instantRate * (1 - smoothing);
                }
            }
        }
        this.lastRateAt = currentTime;
        this.updatedAtValue = currentTime;
    }
    render(force = false) {
        if (this.closedValue) {
            return;
        }
        this.renderer.update(this, force);
    }
    shouldRunAnimation() {
        return (!this.closedValue &&
            this.normalizedOptions.enabled &&
            this.renderer.animated &&
            this.getMode() === "indeterminate");
    }
    stopAnimationTimer() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = undefined;
        }
    }
    syncAnimationTimer() {
        if (!this.shouldRunAnimation()) {
            this.stopAnimationTimer();
            return;
        }
        if (this.animationTimer) {
            return;
        }
        const interval = this.normalizedOptions.indeterminateInterval || this.normalizedOptions.interval;
        this.animationTimer = setInterval(() => {
            if (!this.shouldRunAnimation()) {
                this.stopAnimationTimer();
                return;
            }
            this.frameIndexValue += 1;
            this.updatedAtValue = now();
            this.renderer.update(this, true);
        }, interval);
        if (typeof this.animationTimer.unref === "function") {
            this.animationTimer.unref();
        }
    }
    increment(delta = 1) {
        if (this.closedValue) {
            return this;
        }
        const numericDelta = assertFiniteNumber(delta, "delta");
        normalizeNonNegativeNumber(numericDelta, "delta");
        const previous = this.currentValue;
        this.currentValue = Math.max(0, this.currentValue + numericDelta);
        this.updateRate(previous, this.currentValue);
        this.syncAnimationTimer();
        this.render(false);
        return this;
    }
    update(value) {
        if (this.closedValue) {
            return this;
        }
        const previous = this.currentValue;
        this.currentValue = Math.max(0, assertFiniteNumber(value, "value"));
        this.updateRate(previous, this.currentValue);
        this.syncAnimationTimer();
        this.render(false);
        return this;
    }
    setTotal(total) {
        if (this.closedValue) {
            return this;
        }
        this.totalValue = normalizeOptionalNonNegativeNumber(total, "total");
        if (this.totalValue != null) {
            this.normalizedOptions.mode = "determinate";
        }
        else if (this.normalizedOptions.mode === "determinate") {
            this.normalizedOptions.mode = "auto";
        }
        this.updatedAtValue = now();
        this.syncAnimationTimer();
        this.render(true);
        return this;
    }
    setMode(mode) {
        if (this.closedValue) {
            return this;
        }
        this.normalizedOptions.mode = normalizeMode(mode);
        this.updatedAtValue = now();
        this.syncAnimationTimer();
        this.render(true);
        return this;
    }
    setStatus(status) {
        if (this.closedValue) {
            return this;
        }
        this.statusValue = String(status);
        this.updatedAtValue = now();
        this.render(true);
        return this;
    }
    setLabel(label) {
        if (this.closedValue) {
            return this;
        }
        this.normalizedOptions.label = label == null || label === "" ? undefined : String(label);
        this.updatedAtValue = now();
        this.render(true);
        return this;
    }
    setPostfix(postfix) {
        if (this.closedValue) {
            return this;
        }
        this.postfixValue = { ...(postfix || {}) };
        this.updatedAtValue = now();
        this.render(true);
        return this;
    }
    onClose(listener) {
        if (typeof listener !== "function") {
            throw new TypeError("onClose(listener) expects listener to be a function.");
        }
        if (this.closedValue) {
            listener(this, this.finishState, this.finishMessage);
            return this;
        }
        this.closeListeners.add(listener);
        return this;
    }
    log(message) {
        this.renderer.log(this, "info", safeMessage(message));
        return this;
    }
    warn(message) {
        this.renderer.log(this, "warn", safeMessage(message));
        return this;
    }
    error(message) {
        this.renderer.log(this, "error", safeMessage(message));
        return this;
    }
    close(message) {
        return this.finish("closed", message);
    }
    succeed(message = "done") {
        return this.finish("success", message);
    }
    fail(errorOrMessage) {
        return this.finish("failure", safeMessage(errorOrMessage));
    }
    cancel(message = "cancelled") {
        return this.finish("cancelled", message);
    }
    finish(state, message) {
        if (this.closedValue) {
            return this;
        }
        this.closedValue = true;
        this.updatedAtValue = now();
        this.stopAnimationTimer();
        if (this.normalizedOptions.signal && this.abortHandler) {
            this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
            this.abortHandler = undefined;
        }
        const finalMessage = safeMessage(message);
        this.finishState = state;
        this.finishMessage = finalMessage;
        const errors = [];
        try {
            this.renderer.finalize(this, state, finalMessage, this.normalizedOptions.leave);
        }
        catch (error) {
            errors.push(error);
        }
        try {
            this.renderer.dispose();
        }
        catch (error) {
            errors.push(error);
        }
        const listeners = [...this.closeListeners];
        this.closeListeners.clear();
        for (const listener of listeners) {
            try {
                listener(this, state, finalMessage);
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length)
            throw errors[0];
        return this;
    }
}
export function createProgressBar(options = {}) {
    return new ProgressBar(options);
}
