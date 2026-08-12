"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressBar = void 0;
exports.createProgressBar = createProgressBar;
const options_js_1 = require("../core/options.js");
const snapshot_js_1 = require("../core/snapshot.js");
const utils_js_1 = require("../core/utils.js");
const renderers_js_1 = require("../rendering/renderers.js");
const lifecycle_js_1 = require("./lifecycle.js");
class ProgressBar {
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
    renderer;
    abortHandler;
    animationTimer;
    constructor(options = {}) {
        this.id = (0, lifecycle_js_1.allocateProgressBarId)();
        this.normalizedOptions = (0, options_js_1.normalizeOptions)(options);
        this.currentValue = (0, utils_js_1.normalizeOptionalNonNegativeNumber)(this.normalizedOptions.current, "current") ?? 0;
        this.totalValue = (0, utils_js_1.normalizeOptionalNonNegativeNumber)(this.normalizedOptions.total, "total");
        this.statusValue = this.normalizedOptions.status;
        this.postfixValue = (0, snapshot_js_1.cloneData)(this.normalizedOptions.postfix || {});
        this.startedAtValue = (0, utils_js_1.now)();
        this.updatedAtValue = this.startedAtValue;
        this.lastRateAt = this.startedAtValue;
        this.ratePerSecond = null;
        this.frameIndexValue = 0;
        this.closedValue = false;
        this.renderer = (0, renderers_js_1.createRenderer)(this.normalizedOptions);
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
        const snapshot = { ...this.normalizedOptions };
        delete snapshot.output;
        delete snapshot.signal;
        delete snapshot.onRender;
        return (0, snapshot_js_1.readonlySnapshot)(snapshot);
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
        return (0, snapshot_js_1.readonlySnapshot)(this.postfixValue);
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
        const currentTime = (0, utils_js_1.now)();
        const elapsedMs = Math.max(0, currentTime - this.startedAtValue);
        const rate = this.ratePerSecond ?? (elapsedMs > 0 && this.currentValue > 0 ? this.currentValue / (elapsedMs / 1000) : null);
        const remainingMs = this.totalValue != null && rate != null && rate > 0 && elapsedMs >= this.normalizedOptions.minElapsedMsForEta
            ? Math.max(0, (this.totalValue - this.currentValue) / rate) * 1000
            : null;
        return {
            id: this.id,
            current: this.currentValue,
            total: this.totalValue,
            mode: this.getMode(),
            status: this.statusValue,
            postfix: (0, snapshot_js_1.readonlySnapshot)(this.postfixValue),
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
        const currentTime = (0, utils_js_1.now)();
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
            this.updatedAtValue = (0, utils_js_1.now)();
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
        const numericDelta = (0, utils_js_1.assertFiniteNumber)(delta, "delta");
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
        this.currentValue = Math.max(0, (0, utils_js_1.assertFiniteNumber)(value, "value"));
        this.updateRate(previous, this.currentValue);
        this.syncAnimationTimer();
        this.render(false);
        return this;
    }
    setTotal(total) {
        if (this.closedValue) {
            return this;
        }
        this.totalValue = (0, utils_js_1.normalizeOptionalNonNegativeNumber)(total, "total");
        if (this.totalValue != null) {
            this.normalizedOptions.mode = "determinate";
        }
        else if (this.normalizedOptions.mode === "determinate") {
            this.normalizedOptions.mode = "auto";
        }
        this.updatedAtValue = (0, utils_js_1.now)();
        this.syncAnimationTimer();
        this.render(true);
        return this;
    }
    setMode(mode) {
        if (this.closedValue) {
            return this;
        }
        this.normalizedOptions.mode = (0, options_js_1.normalizeMode)(mode);
        this.updatedAtValue = (0, utils_js_1.now)();
        this.syncAnimationTimer();
        this.render(true);
        return this;
    }
    setStatus(status) {
        if (this.closedValue) {
            return this;
        }
        this.statusValue = String(status);
        this.updatedAtValue = (0, utils_js_1.now)();
        this.render(true);
        return this;
    }
    setPostfix(postfix) {
        if (this.closedValue) {
            return this;
        }
        this.postfixValue = (0, snapshot_js_1.cloneData)(postfix || {});
        this.updatedAtValue = (0, utils_js_1.now)();
        this.render(true);
        return this;
    }
    log(message) {
        this.renderer.log(this, "info", (0, utils_js_1.safeMessage)(message));
        return this;
    }
    warn(message) {
        this.renderer.log(this, "warn", (0, utils_js_1.safeMessage)(message));
        return this;
    }
    error(message) {
        this.renderer.log(this, "error", (0, utils_js_1.safeMessage)(message));
        return this;
    }
    close(message, options = {}) {
        return this.finish("closed", message, options.leave);
    }
    succeed(message = "done") {
        return this.finish("success", message);
    }
    fail(errorOrMessage) {
        return this.finish("failure", (0, utils_js_1.safeMessage)(errorOrMessage));
    }
    cancel(message = "cancelled") {
        return this.finish("cancelled", message);
    }
    finish(state, message, leave) {
        if (this.closedValue) {
            return this;
        }
        this.closedValue = true;
        this.updatedAtValue = (0, utils_js_1.now)();
        this.stopAnimationTimer();
        if (this.normalizedOptions.signal && this.abortHandler) {
            this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
            this.abortHandler = undefined;
        }
        try {
            this.renderer.finalize(this, state, (0, utils_js_1.safeMessage)(message), leave ?? this.normalizedOptions.leave);
        }
        finally {
            try {
                this.renderer.dispose();
            }
            finally {
                (0, lifecycle_js_1.notifyProgressBarClose)(this);
            }
        }
        return this;
    }
}
exports.ProgressBar = ProgressBar;
function createProgressBar(options = {}) {
    return new ProgressBar(options);
}
