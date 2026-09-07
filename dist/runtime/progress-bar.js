import { normalizeMode, normalizeOptions } from "../core/options.js";
import { ProgressClock } from "../core/progress-clock.js";
import { cloneData, readonlySnapshot } from "../core/snapshot.js";
import { assertFiniteNumber, normalizeOptionalNonNegativeNumber, safeMessage } from "../core/utils.js";
import { createRenderer } from "../rendering/renderers.js";
import { allocateProgressBarId, notifyProgressBarClose } from "./lifecycle.js";
export class ProgressBar {
    id;
    normalizedOptions;
    currentValue;
    totalValue;
    statusValue;
    postfixValue;
    modeValue;
    clock;
    optionsSnapshot;
    frameIndexValue;
    closedValue;
    renderer;
    abortHandler;
    animationTimer;
    constructor(options = {}) {
        this.id = allocateProgressBarId();
        this.normalizedOptions = normalizeOptions(options);
        this.currentValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.current, "current") ?? 0;
        this.totalValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.total, "total");
        this.statusValue = this.normalizedOptions.status;
        this.postfixValue = cloneData(this.normalizedOptions.postfix || {});
        this.modeValue = this.normalizedOptions.mode;
        this.clock = new ProgressClock();
        const optionsSnapshot = { ...this.normalizedOptions };
        delete optionsSnapshot.output;
        delete optionsSnapshot.signal;
        delete optionsSnapshot.onRender;
        this.optionsSnapshot = readonlySnapshot(optionsSnapshot);
        this.frameIndexValue = 0;
        this.closedValue = false;
        this.renderer = createRenderer(this.normalizedOptions);
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
        this.renderer.register(this);
        this.syncAnimationTimer();
    }
    get options() {
        if (this.optionsSnapshot.mode === this.modeValue) {
            return this.optionsSnapshot;
        }
        return Object.freeze({ ...this.optionsSnapshot, mode: this.modeValue });
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
    get postfix() {
        return readonlySnapshot(this.postfixValue);
    }
    get startedAt() {
        return this.clock.startedAt;
    }
    get updatedAt() {
        return this.clock.updatedAt;
    }
    get frameIndex() {
        return this.frameIndexValue;
    }
    get closed() {
        return this.closedValue;
    }
    getMode() {
        if (this.modeValue !== "auto") {
            return this.modeValue;
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
        return {
            id: this.id,
            current: this.currentValue,
            total: this.totalValue,
            mode: this.getMode(),
            status: this.statusValue,
            postfix: readonlySnapshot(this.postfixValue),
            frameIndex: this.frameIndexValue,
            options: this.options,
            timing: this.clock.snapshot(this.currentValue, this.totalValue, this.normalizedOptions.minElapsedMsForEta),
        };
    }
    render(force = false) {
        if (this.closedValue) {
            return;
        }
        this.renderer.update(this, force);
    }
    shouldAnimate() {
        return (this.normalizedOptions.enabled &&
            this.normalizedOptions.renderer !== "silent" &&
            this.getMode() === "indeterminate");
    }
    startAnimationTimer() {
        if (this.animationTimer || !this.shouldAnimate()) {
            return;
        }
        const interval = this.normalizedOptions.indeterminateInterval || this.normalizedOptions.interval;
        this.animationTimer = setInterval(() => {
            if (this.closedValue || !this.shouldAnimate()) {
                this.stopAnimationTimer();
                return;
            }
            this.frameIndexValue += 1;
            this.clock.touch();
            this.renderer.update(this, true);
        }, interval);
        if (typeof this.animationTimer.unref === "function") {
            this.animationTimer.unref();
        }
    }
    stopAnimationTimer() {
        if (!this.animationTimer) {
            return;
        }
        clearInterval(this.animationTimer);
        this.animationTimer = undefined;
    }
    syncAnimationTimer() {
        if (this.shouldAnimate()) {
            this.startAnimationTimer();
        }
        else {
            this.stopAnimationTimer();
        }
    }
    increment(delta = 1) {
        if (this.closedValue) {
            return this;
        }
        const numericDelta = assertFiniteNumber(delta, "delta");
        const previous = this.currentValue;
        this.currentValue = Math.max(0, this.currentValue + numericDelta);
        this.clock.updateRate(previous, this.currentValue, this.normalizedOptions.rateSmoothing);
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
        this.clock.updateRate(previous, this.currentValue, this.normalizedOptions.rateSmoothing);
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
            this.modeValue = "determinate";
        }
        else if (this.modeValue === "determinate") {
            this.modeValue = "auto";
        }
        this.clock.touch();
        this.syncAnimationTimer();
        this.render(true);
        return this;
    }
    setMode(mode) {
        if (this.closedValue) {
            return this;
        }
        this.modeValue = normalizeMode(mode);
        this.clock.touch();
        this.syncAnimationTimer();
        this.render(true);
        return this;
    }
    setStatus(status) {
        if (this.closedValue) {
            return this;
        }
        this.statusValue = String(status);
        this.clock.touch();
        this.render(true);
        return this;
    }
    setPostfix(postfix) {
        if (this.closedValue) {
            return this;
        }
        this.postfixValue = cloneData(postfix || {});
        this.clock.touch();
        this.render(true);
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
    close(message, options = {}) {
        return this.finish("closed", message, options.leave);
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
    finish(state, message, leave) {
        if (this.closedValue) {
            return this;
        }
        this.closedValue = true;
        this.clock.touch();
        this.stopAnimationTimer();
        if (this.normalizedOptions.signal && this.abortHandler) {
            this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
            this.abortHandler = undefined;
        }
        try {
            this.renderer.finalize(this, state, safeMessage(message), leave ?? this.normalizedOptions.leave);
        }
        finally {
            try {
                this.renderer.dispose();
            }
            finally {
                notifyProgressBarClose(this);
            }
        }
        return this;
    }
}
export function createProgressBar(options = {}) {
    return new ProgressBar(options);
}
