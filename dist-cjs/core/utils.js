"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextProgressBarId = exports.DEFAULT_MIN_ETA_ELAPSED_MS = exports.DEFAULT_RATE_SMOOTHING = exports.DEFAULT_INTERVAL_MS = exports.DEFAULT_TERMINAL_WIDTH = exports.DEFAULT_SPINNER_ASCII = exports.DEFAULT_SPINNER_UNICODE = void 0;
exports.now = now;
exports.isFiniteNumber = isFiniteNumber;
exports.clampNumber = clampNumber;
exports.isAbortErrorLike = isAbortErrorLike;
exports.makeAbortError = makeAbortError;
exports.ensureNotAborted = ensureNotAborted;
exports.isAsyncIterable = isAsyncIterable;
exports.isIterable = isIterable;
exports.inferTotal = inferTotal;
exports.chooseCharset = chooseCharset;
exports.stripAnsi = stripAnsi;
exports.displayWidth = displayWidth;
exports.truncateDisplay = truncateDisplay;
exports.padLeft = padLeft;
exports.formatDuration = formatDuration;
exports.formatNumber = formatNumber;
exports.formatBytes = formatBytes;
exports.pluralizeUnit = pluralizeUnit;
exports.formatAmount = formatAmount;
exports.formatRate = formatRate;
exports.stringifyPostfix = stringifyPostfix;
exports.safeMessage = safeMessage;
exports.assertFiniteNumber = assertFiniteNumber;
exports.normalizeNonNegativeNumber = normalizeNonNegativeNumber;
exports.normalizeOptionalNonNegativeNumber = normalizeOptionalNonNegativeNumber;
const node_perf_hooks_1 = require("node:perf_hooks");
exports.DEFAULT_SPINNER_UNICODE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
exports.DEFAULT_SPINNER_ASCII = ["-", "\\", "|", "/"];
exports.DEFAULT_TERMINAL_WIDTH = 80;
exports.DEFAULT_INTERVAL_MS = 80;
exports.DEFAULT_RATE_SMOOTHING = 0.85;
exports.DEFAULT_MIN_ETA_ELAPSED_MS = 0;
exports.nextProgressBarId = 1;
function now() {
    return node_perf_hooks_1.performance.now();
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function clampNumber(value, minimum, maximum) {
    if (value < minimum) {
        return minimum;
    }
    if (value > maximum) {
        return maximum;
    }
    return value;
}
function isAbortErrorLike(error) {
    return error != null && typeof error === "object" && "name" in error && error.name === "AbortError";
}
function makeAbortError() {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
}
function ensureNotAborted(signal) {
    if (signal?.aborted) {
        throw makeAbortError();
    }
}
function isAsyncIterable(value) {
    return value != null && typeof value[Symbol.asyncIterator] === "function";
}
function isIterable(value) {
    return value != null && typeof value[Symbol.iterator] === "function";
}
function inferTotal(input) {
    if (input == null) {
        return undefined;
    }
    if (typeof input === "object" && "length" in input && isFiniteNumber(input.length)) {
        return input.length;
    }
    if (typeof input === "object" && "size" in input && isFiniteNumber(input.size)) {
        return input.size;
    }
    return undefined;
}
function chooseCharset(options, output) {
    if (options.charset === "ascii") {
        return "ascii";
    }
    if (options.charset === "unicode") {
        return "unicode";
    }
    if (process.env.FLOWBAR_ASCII === "1" || process.env.FLOWBAR_ASCII === "true") {
        return "ascii";
    }
    if (process.env.LC_ALL === "C" || process.env.LANG === "C") {
        return "ascii";
    }
    if (output && output.isTTY === false && process.env.FLOWBAR_UNICODE !== "1") {
        return "ascii";
    }
    return "unicode";
}
function stripAnsi(value) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape parsing requires the ESC control character.
    return String(value).replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}
function isZeroWidthCodePoint(codePoint) {
    return (codePoint === 0x200d ||
        (codePoint >= 0x0300 && codePoint <= 0x036f) ||
        (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
        (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
        (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
        (codePoint >= 0xfe00 && codePoint <= 0xfe0f));
}
function codePointWidth(codePoint) {
    if (codePoint === 0) {
        return 0;
    }
    if (isZeroWidthCodePoint(codePoint) || codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) {
        return 0;
    }
    if ((codePoint >= 0x1100 && codePoint <= 0x115f) ||
        (codePoint >= 0x2329 && codePoint <= 0x232a) ||
        (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
        (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
        (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
        (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
        (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
        (codePoint >= 0xff00 && codePoint <= 0xff60) ||
        (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
        (codePoint >= 0x1f300 && codePoint <= 0x1faff)) {
        return 2;
    }
    return 1;
}
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const emojiClusterPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
function graphemeWidth(value) {
    if (emojiClusterPattern.test(value)) {
        return 2;
    }
    let width = 0;
    for (const char of value) {
        width = Math.max(width, codePointWidth(char.codePointAt(0) ?? 0));
    }
    return width;
}
function displayWidth(value) {
    const plain = stripAnsi(value);
    let width = 0;
    for (const { segment } of graphemeSegmenter.segment(plain)) {
        width += graphemeWidth(segment);
    }
    return width;
}
function readAnsiSequence(text, start) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape parsing requires the ESC control character.
    const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
    return match?.[0];
}
function displayTokens(text) {
    const tokens = [];
    for (let index = 0; index < text.length;) {
        const ansi = readAnsiSequence(text, index);
        if (ansi) {
            tokens.push({ text: ansi, width: 0 });
            index += ansi.length;
            continue;
        }
        const nextEscape = text.indexOf("\u001B", index);
        const end = nextEscape === -1 ? text.length : nextEscape === index ? index + 1 : nextEscape;
        const plain = text.slice(index, end);
        for (const { segment } of graphemeSegmenter.segment(plain)) {
            tokens.push({ text: segment, width: graphemeWidth(segment) });
        }
        index += plain.length;
    }
    return tokens;
}
function truncateDisplay(value, maxWidth) {
    const text = String(value);
    if (maxWidth <= 0) {
        return "";
    }
    if (displayWidth(text) <= maxWidth) {
        return text;
    }
    if (maxWidth === 1) {
        return "…";
    }
    let result = "";
    let width = 0;
    const targetWidth = Math.max(0, maxWidth - 1);
    for (const token of displayTokens(text)) {
        if (width + token.width > targetWidth) {
            break;
        }
        result += token.text;
        width += token.width;
    }
    return `${result}…`;
}
function padLeft(value, width, fill = " ") {
    const text = String(value);
    return `${fill.repeat(Math.max(0, width - text.length))}${text}`;
}
function formatDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        return "--:--";
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    if (hours > 0) {
        return `${hours}:${padLeft(minutes, 2, "0")}:${padLeft(seconds, 2, "0")}`;
    }
    return `${padLeft(minutes, 2, "0")}:${padLeft(seconds, 2, "0")}`;
}
function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "?";
    }
    if (Math.abs(value) >= 1000) {
        return Math.round(value).toLocaleString("en-US");
    }
    if (Math.abs(value) >= 10) {
        return value.toFixed(1).replace(/\.0$/, "");
    }
    if (Math.abs(value) > 0 && Math.abs(value) < 1) {
        return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }
    return String(Math.round(value));
}
function formatBytes(value) {
    if (!Number.isFinite(value)) {
        return "? B";
    }
    const sign = value < 0 ? "-" : "";
    let absolute = Math.abs(value);
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let unitIndex = 0;
    while (absolute >= 1024 && unitIndex < units.length - 1) {
        absolute /= 1024;
        unitIndex += 1;
    }
    const precision = unitIndex === 0 ? 0 : absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
    return `${sign}${absolute.toFixed(precision).replace(/\.0+$/, "")} ${units[unitIndex]}`;
}
function pluralizeUnit(unit, value) {
    if (!unit || unit === "byte") {
        return unit || "item";
    }
    if (Math.abs(value) === 1 || unit.endsWith("s")) {
        return unit;
    }
    return `${unit}s`;
}
function formatAmount(value, unit) {
    if (unit === "byte") {
        return formatBytes(value);
    }
    return formatNumber(value);
}
function formatRate(rate, unit) {
    if (!Number.isFinite(rate) || rate <= 0) {
        return "?";
    }
    if (unit === "byte") {
        return `${formatBytes(rate)}/s`;
    }
    return `${formatNumber(rate)} ${pluralizeUnit(unit || "item", rate)}/s`;
}
function stringifyPostfix(postfix) {
    if (!postfix || typeof postfix !== "object") {
        return "";
    }
    const parts = [];
    for (const [key, value] of Object.entries(postfix)) {
        if (value == null) {
            continue;
        }
        parts.push(`${key}=${String(value)}`);
    }
    return parts.join(" ");
}
function safeMessage(value) {
    if (value == null) {
        return "";
    }
    if (value instanceof Error) {
        return value.message || value.name;
    }
    return String(value);
}
function assertFiniteNumber(value, name) {
    if (!isFiniteNumber(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}
function normalizeNonNegativeNumber(value, name) {
    if (value < 0) {
        throw new RangeError(`${name} must be greater than or equal to 0.`);
    }
    return value;
}
function normalizeOptionalNonNegativeNumber(value, name) {
    if (value == null) {
        return undefined;
    }
    return normalizeNonNegativeNumber(assertFiniteNumber(value, name), name);
}
