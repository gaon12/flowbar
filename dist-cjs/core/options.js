"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CONCURRENCY = void 0;
exports.normalizeMode = normalizeMode;
exports.normalizeAnimation = normalizeAnimation;
exports.normalizePreset = normalizePreset;
exports.normalizeConcurrency = normalizeConcurrency;
exports.normalizeOptions = normalizeOptions;
exports.getTerminalWidth = getTerminalWidth;
const color_js_1 = require("./color.js");
const snapshot_js_1 = require("./snapshot.js");
const utils_js_1 = require("./utils.js");
exports.MAX_CONCURRENCY = 1024;
function normalizeRenderer(renderer) {
    if (renderer == null || renderer === "") {
        return "auto";
    }
    if (renderer === "auto" ||
        renderer === "terminal" ||
        renderer === "plain" ||
        renderer === "silent" ||
        renderer === "json" ||
        renderer === "memory") {
        return renderer;
    }
    throw new TypeError('renderer must be one of "auto", "terminal", "plain", "silent", "json", or "memory".');
}
function normalizeCharset(charset) {
    if (charset == null || charset === "") {
        return "auto";
    }
    if (charset === "auto" || charset === "unicode" || charset === "ascii") {
        return charset;
    }
    throw new TypeError('charset must be one of "auto", "unicode", or "ascii".');
}
function normalizeMode(mode) {
    if (mode == null || mode === "") {
        return "auto";
    }
    if (mode === "auto" || mode === "determinate" || mode === "counting" || mode === "indeterminate") {
        return mode;
    }
    throw new TypeError(`mode must be one of "auto", "determinate", "counting", or "indeterminate".`);
}
function normalizeAnimation(animation) {
    if (animation == null || animation === "") {
        return "spinner";
    }
    if (animation === "spinner" || animation === "marquee" || animation === "bounce" || animation === "pulse") {
        return animation;
    }
    throw new TypeError(`animation must be one of "spinner", "marquee", "bounce", or "pulse".`);
}
function normalizePreset(preset) {
    if (preset == null || preset === "") {
        return "tqdm";
    }
    if (preset === "tqdm" || preset === "compact" || preset === "verbose" || preset === "minimal") {
        return preset;
    }
    throw new TypeError(`preset must be one of "tqdm", "compact", "verbose", or "minimal".`);
}
function normalizeBarTrack(barTrack) {
    if (barTrack == null || barTrack === "") {
        return "blank";
    }
    if (barTrack === "blank" || barTrack === "shaded") {
        return barTrack;
    }
    throw new TypeError('barTrack must be either "blank" or "shaded".');
}
function normalizeConcurrency(value) {
    if (value == null) {
        return 1;
    }
    const concurrency = (0, utils_js_1.assertFiniteNumber)(value, "concurrency");
    if (!Number.isInteger(concurrency)) {
        throw new RangeError("concurrency must be an integer.");
    }
    if (concurrency < 1) {
        throw new RangeError("concurrency must be greater than or equal to 1.");
    }
    if (concurrency > exports.MAX_CONCURRENCY) {
        throw new RangeError(`concurrency must be less than or equal to ${exports.MAX_CONCURRENCY}.`);
    }
    return concurrency;
}
function normalizeOptions(options = {}) {
    const output = options.output ?? process.stderr;
    if (typeof output.write !== "function") {
        throw new TypeError("output must provide a write(chunk) function.");
    }
    if (options.onRender != null && typeof options.onRender !== "function") {
        throw new TypeError("onRender must be a function.");
    }
    const renderer = normalizeRenderer(options.renderer);
    const unit = options.unit || "item";
    const interval = (0, utils_js_1.isFiniteNumber)(options.interval) ? Math.max(16, options.interval) : utils_js_1.DEFAULT_INTERVAL_MS;
    return {
        ...options,
        output,
        renderer,
        unit,
        interval,
        mode: normalizeMode(options.mode),
        preset: normalizePreset(options.preset),
        barTrack: normalizeBarTrack(options.barTrack),
        animation: normalizeAnimation(options.animation || options.indeterminateStyle),
        status: options.status || "running",
        enabled: options.enabled !== false,
        leave: options.leave !== false,
        color: (0, color_js_1.resolveColor)(options.color, output),
        dynamicWidth: options.dynamicWidth !== false,
        adaptiveLayout: options.adaptiveLayout !== false,
        wrapGuardColumns: (0, utils_js_1.isFiniteNumber)(options.wrapGuardColumns) ? Math.max(0, options.wrapGuardColumns) : 0,
        rateSmoothing: (0, utils_js_1.isFiniteNumber)(options.rateSmoothing)
            ? (0, utils_js_1.clampNumber)(options.rateSmoothing, 0, 0.99)
            : utils_js_1.DEFAULT_RATE_SMOOTHING,
        minElapsedMsForEta: (0, utils_js_1.isFiniteNumber)(options.minElapsedMsForEta)
            ? Math.max(0, options.minElapsedMsForEta)
            : utils_js_1.DEFAULT_MIN_ETA_ELAPSED_MS,
        charset: (0, utils_js_1.chooseCharset)({ ...options, charset: normalizeCharset(options.charset) }, output),
        postfix: options.postfix ? (0, snapshot_js_1.cloneData)(options.postfix) : undefined,
        spinnerFrames: Array.isArray(options.spinnerFrames) && options.spinnerFrames.length > 0
            ? options.spinnerFrames.map(String)
            : undefined,
    };
}
function getTerminalWidth(output, options) {
    if ((0, utils_js_1.isFiniteNumber)(options.width) && options.width > 0) {
        return Math.floor(options.width);
    }
    if (options.dynamicWidth !== false && (0, utils_js_1.isFiniteNumber)(output?.columns)) {
        return Math.max(1, Math.floor(output.columns - options.wrapGuardColumns));
    }
    return Math.max(1, utils_js_1.DEFAULT_TERMINAL_WIDTH - options.wrapGuardColumns);
}
