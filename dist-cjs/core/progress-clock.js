"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressClock = void 0;
const utils_js_1 = require("./utils.js");
class ProgressClock {
    startedAt;
    updatedAtValue;
    lastRateAt;
    ratePerSecond = null;
    constructor() {
        this.startedAt = (0, utils_js_1.now)();
        this.updatedAtValue = this.startedAt;
        this.lastRateAt = this.startedAt;
    }
    get updatedAt() {
        return this.updatedAtValue;
    }
    touch() {
        this.updatedAtValue = (0, utils_js_1.now)();
    }
    updateRate(previousValue, nextValue, smoothing) {
        const currentTime = (0, utils_js_1.now)();
        const elapsedSeconds = (currentTime - this.lastRateAt) / 1000;
        const delta = nextValue - previousValue;
        if (elapsedSeconds > 0 && delta > 0) {
            const instantRate = delta / elapsedSeconds;
            this.ratePerSecond =
                this.ratePerSecond == null ? instantRate : this.ratePerSecond * smoothing + instantRate * (1 - smoothing);
        }
        this.lastRateAt = currentTime;
        this.updatedAtValue = currentTime;
    }
    snapshot(current, total, minElapsedMsForEta) {
        const currentTime = (0, utils_js_1.now)();
        const elapsedMs = Math.max(0, currentTime - this.startedAt);
        const rate = this.ratePerSecond ?? (elapsedMs > 0 && current > 0 ? current / (elapsedMs / 1000) : null);
        const remainingMs = total != null && rate != null && rate > 0 && elapsedMs >= minElapsedMsForEta
            ? Math.max(0, (total - current) / rate) * 1000
            : null;
        return {
            startedAt: this.startedAt,
            updatedAt: this.updatedAtValue,
            elapsedMs,
            remainingMs,
            etaAt: remainingMs == null ? null : Date.now() + remainingMs,
            ratePerSecond: rate,
        };
    }
}
exports.ProgressClock = ProgressClock;
