import { performance } from "node:perf_hooks";
export const DEFAULT_SPINNER_UNICODE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const DEFAULT_SPINNER_ASCII = ["-", "\\", "|", "/"];
export const DEFAULT_TERMINAL_WIDTH = 80;
export const DEFAULT_INTERVAL_MS = 80;
export const DEFAULT_RATE_SMOOTHING = 0.85;
export const DEFAULT_MIN_ETA_ELAPSED_MS = 500;
export const nextProgressBarId = 1;
export function now() {
    return performance.now();
}
export function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
export function clampNumber(value, minimum, maximum) {
    if (value < minimum) {
        return minimum;
    }
    if (value > maximum) {
        return maximum;
    }
    return value;
}
export function isAbortErrorLike(error) {
    return error != null && typeof error === "object" && "name" in error && error.name === "AbortError";
}
export function makeAbortError() {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
}
export function ensureNotAborted(signal) {
    if (signal?.aborted) {
        throw makeAbortError();
    }
}
export function isAsyncIterable(value) {
    return value != null && typeof value[Symbol.asyncIterator] === "function";
}
export function isIterable(value) {
    return value != null && typeof value[Symbol.iterator] === "function";
}
export function inferTotal(input) {
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
export function chooseCharset(options, output) {
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
export function stripAnsi(value) {
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
export function displayWidth(value) {
    const plain = stripAnsi(value);
    let width = 0;
    for (const char of plain) {
        width += codePointWidth(char.codePointAt(0) ?? 0);
    }
    return width;
}
function readAnsiSequence(text, start) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape parsing requires the ESC control character.
    const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
    return match?.[0];
}
export function truncateDisplay(value, maxWidth) {
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
    for (let index = 0; index < text.length;) {
        const ansi = readAnsiSequence(text, index);
        if (ansi) {
            result += ansi;
            index += ansi.length;
            continue;
        }
        const codePoint = text.codePointAt(index) ?? 0;
        const char = String.fromCodePoint(codePoint);
        const charWidth = codePointWidth(codePoint);
        if (width + charWidth > targetWidth) {
            break;
        }
        result += char;
        width += charWidth;
        index += char.length;
    }
    return `${result}…`;
}
export function padLeft(value, width, fill = " ") {
    const text = String(value);
    return `${fill.repeat(Math.max(0, width - text.length))}${text}`;
}
export function formatDuration(milliseconds) {
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
export function formatNumber(value) {
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
export function formatBytes(value) {
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
export function pluralizeUnit(unit, value) {
    if (!unit || unit === "byte") {
        return unit || "item";
    }
    if (Math.abs(value) === 1 || unit.endsWith("s")) {
        return unit;
    }
    return `${unit}s`;
}
export function formatAmount(value, unit) {
    if (unit === "byte") {
        return formatBytes(value);
    }
    return formatNumber(value);
}
export function formatRate(rate, unit) {
    if (!Number.isFinite(rate) || rate <= 0) {
        return "?";
    }
    if (unit === "byte") {
        return `${formatBytes(rate)}/s`;
    }
    return `${formatNumber(rate)} ${pluralizeUnit(unit || "item", rate)}/s`;
}
export function stringifyPostfix(postfix) {
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
export function safeMessage(value) {
    if (value == null) {
        return "";
    }
    if (value instanceof Error) {
        return value.message || value.name;
    }
    return String(value);
}
export function assertFiniteNumber(value, name) {
    if (!isFiniteNumber(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}
export function normalizeNonNegativeNumber(value, name) {
    if (value < 0) {
        throw new RangeError(`${name} must be greater than or equal to 0.`);
    }
    return value;
}
export function normalizeOptionalNonNegativeNumber(value, name) {
    if (value == null) {
        return undefined;
    }
    return normalizeNonNegativeNumber(assertFiniteNumber(value, name), name);
}
