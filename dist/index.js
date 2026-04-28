/**
 * flowbar TypeScript source.
 *
 * 패키지는 zero runtime dependency를 유지하기 위해 Node.js core API만 사용합니다.
 */
import { Transform } from "node:stream";
import { performance } from "node:perf_hooks";
const DEFAULT_SPINNER_UNICODE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const DEFAULT_SPINNER_ASCII = ["-", "\\", "|", "/"];
const DEFAULT_TERMINAL_WIDTH = 80;
const DEFAULT_INTERVAL_MS = 80;
const DEFAULT_RATE_SMOOTHING = 0.85;
const DEFAULT_MIN_ETA_ELAPSED_MS = 500;
let nextProgressBarId = 1;
function now() {
    return performance.now();
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
function displayWidth(value) {
    const plain = stripAnsi(value);
    let width = 0;
    for (const char of plain) {
        width += codePointWidth(char.codePointAt(0) ?? 0);
    }
    return width;
}
function readAnsiSequence(text, start) {
    const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
    return match?.[0];
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
function normalizeConcurrency(value) {
    if (value == null) {
        return 1;
    }
    const concurrency = Math.floor(assertFiniteNumber(value, "concurrency"));
    if (concurrency < 1) {
        throw new RangeError("concurrency must be greater than or equal to 1.");
    }
    return concurrency;
}
function normalizeOptions(options = {}) {
    const output = options.output || process.stderr;
    const renderer = options.renderer || "auto";
    const unit = options.unit || "item";
    const interval = isFiniteNumber(options.interval) ? Math.max(16, options.interval) : DEFAULT_INTERVAL_MS;
    return {
        ...options,
        output,
        renderer,
        unit,
        interval,
        mode: normalizeMode(options.mode),
        preset: normalizePreset(options.preset),
        animation: normalizeAnimation(options.animation || options.indeterminateStyle),
        status: options.status || "running",
        enabled: options.enabled !== false,
        leave: options.leave !== false,
        color: options.color === true,
        dynamicWidth: options.dynamicWidth !== false,
        adaptiveLayout: options.adaptiveLayout !== false,
        wrapGuardColumns: isFiniteNumber(options.wrapGuardColumns) ? Math.max(0, options.wrapGuardColumns) : 1,
        rateSmoothing: isFiniteNumber(options.rateSmoothing)
            ? clampNumber(options.rateSmoothing, 0, 0.99)
            : DEFAULT_RATE_SMOOTHING,
        minElapsedMsForEta: isFiniteNumber(options.minElapsedMsForEta)
            ? Math.max(0, options.minElapsedMsForEta)
            : DEFAULT_MIN_ETA_ELAPSED_MS,
        charset: chooseCharset(options, output),
        spinnerFrames: Array.isArray(options.spinnerFrames) && options.spinnerFrames.length > 0
            ? options.spinnerFrames.map(String)
            : undefined,
    };
}
function getTerminalWidth(output, options) {
    if (isFiniteNumber(options.width) && options.width > 0) {
        return Math.floor(options.width);
    }
    if (options.dynamicWidth !== false && isFiniteNumber(output?.columns)) {
        return Math.max(1, Math.floor(output.columns - options.wrapGuardColumns));
    }
    return Math.max(1, DEFAULT_TERMINAL_WIDTH - options.wrapGuardColumns);
}
function makeBar(width, ratio, charset) {
    const safeWidth = Math.max(0, Math.floor(width));
    const safeRatio = clampNumber(Number.isFinite(ratio) ? ratio : 0, 0, 1);
    const filledCount = Math.round(safeWidth * safeRatio);
    const full = charset === "ascii" ? "#" : "█";
    const empty = charset === "ascii" ? "-" : "░";
    return `${full.repeat(filledCount)}${empty.repeat(Math.max(0, safeWidth - filledCount))}`;
}
function makeIndeterminateBar(width, frameIndex, style, segmentWidth, charset) {
    const safeWidth = Math.max(1, Math.floor(width));
    const full = charset === "ascii" ? "#" : "█";
    const empty = charset === "ascii" ? "-" : "░";
    const segment = clampNumber(Math.floor(segmentWidth || Math.max(3, safeWidth * 0.28)), 1, safeWidth);
    const chars = Array.from({ length: safeWidth }, () => empty);
    if (style === "pulse") {
        const maxSegment = safeWidth;
        const minSegment = Math.min(segment, maxSegment);
        const cycle = Math.max(1, (maxSegment - minSegment) * 2);
        const step = frameIndex % cycle;
        const size = step <= maxSegment - minSegment
            ? minSegment + step
            : maxSegment - (step - (maxSegment - minSegment));
        const start = Math.floor((safeWidth - size) / 2);
        for (let index = start; index < start + size; index += 1) {
            chars[index] = full;
        }
        return chars.join("");
    }
    if (style === "bounce") {
        const maximumPosition = Math.max(0, safeWidth - segment);
        const cycle = Math.max(1, maximumPosition * 2);
        const step = frameIndex % cycle;
        const position = step <= maximumPosition ? step : maximumPosition - (step - maximumPosition);
        for (let index = position; index < position + segment; index += 1) {
            if (index >= 0 && index < chars.length) {
                chars[index] = full;
            }
        }
        return chars.join("");
    }
    const cycle = safeWidth + segment;
    const position = (frameIndex % cycle) - segment;
    for (let index = position; index < position + segment; index += 1) {
        if (index >= 0 && index < chars.length) {
            chars[index] = full;
        }
    }
    return chars.join("");
}
function compactLine(line, width) {
    return truncateDisplay(line.replace(/\s+/g, " ").trim(), width);
}
function colorize(value, code, options) {
    if (!options.color) {
        return value;
    }
    return `\u001B[${code}m${value}\u001B[0m`;
}
function buildDeterminateLine(snapshot, width) {
    const { options } = snapshot;
    const current = Math.max(0, snapshot.current);
    const total = Math.max(0, snapshot.total || 0);
    const ratio = total === 0 ? 1 : clampNumber(current / total, 0, 1);
    const percent = `${padLeft(Math.floor(ratio * 100), 3)}%`;
    const label = options.label ? `${options.label}  ` : "";
    const count = `${formatAmount(current, options.unit)}/${formatAmount(total, options.unit)}`;
    const elapsed = formatDuration(snapshot.timing.elapsedMs);
    const remaining = snapshot.timing.remainingMs == null ? "--:--" : formatDuration(snapshot.timing.remainingMs);
    const rate = formatRate(snapshot.timing.ratePerSecond || 0, options.unit);
    const postfix = stringifyPostfix(snapshot.postfix);
    const charset = options.charset;
    if (options.preset === "minimal") {
        return compactLine(`${label}${percent} ${count}`, width);
    }
    const tailCandidates = [];
    if (options.preset === "verbose") {
        tailCandidates.push(` ${count}`);
        tailCandidates.push(` elapsed ${elapsed}`);
        tailCandidates.push(` remaining ${remaining}`);
        tailCandidates.push(` ${rate}`);
    }
    else if (options.preset === "compact") {
        tailCandidates.push(` ${count}`);
        tailCandidates.push(` ${elapsed}<${remaining}`);
    }
    else {
        tailCandidates.push(` ${count}`);
        tailCandidates.push(` [${elapsed}<${remaining}, ${rate}]`);
    }
    if (postfix) {
        tailCandidates.push(` ${postfix}`);
    }
    let tails = tailCandidates.slice();
    while (tails.length >= 0) {
        const tail = tails.join("");
        const fixedWidth = displayWidth(`${label}${percent} ||${tail}`);
        const barWidth = width - fixedWidth;
        if (barWidth >= 6) {
            const bar = makeBar(barWidth, ratio, charset);
            return compactLine(`${label}${percent} |${bar}|${tail}`, width);
        }
        if (tails.length === 0) {
            break;
        }
        tails.pop();
    }
    return compactLine(`${label}${percent} ${count}`, width);
}
function buildCountingLine(snapshot, width) {
    const { options } = snapshot;
    const label = options.label ? `${options.label}  ` : "";
    const unit = pluralizeUnit(options.unit || "item", snapshot.current);
    const count = options.unit === "byte" ? formatBytes(snapshot.current) : `${formatAmount(snapshot.current, options.unit)} ${unit}`;
    const elapsed = formatDuration(snapshot.timing.elapsedMs);
    const rate = formatRate(snapshot.timing.ratePerSecond || 0, options.unit);
    const postfix = stringifyPostfix(snapshot.postfix);
    const candidates = [
        `${label}${count} | elapsed ${elapsed} | ${rate}${postfix ? ` | ${postfix}` : ""}`,
        `${label}${count} | ${elapsed} | ${rate}`,
        `${label}${count} | ${elapsed}`,
        `${label}${count}`,
    ];
    for (const candidate of candidates) {
        if (displayWidth(candidate) <= width) {
            return candidate;
        }
    }
    return compactLine(candidates[candidates.length - 1], width);
}
function buildIndeterminateLine(snapshot, width) {
    const { options } = snapshot;
    const label = options.label ? `${options.label}  ` : "";
    const elapsed = formatDuration(snapshot.timing.elapsedMs);
    const status = snapshot.status || options.status || "running";
    const charset = options.charset;
    const frames = options.spinnerFrames || (charset === "ascii" ? DEFAULT_SPINNER_ASCII : DEFAULT_SPINNER_UNICODE);
    const spinner = frames[snapshot.frameIndex % frames.length];
    const animation = options.animation || "spinner";
    if (animation !== "spinner") {
        const tail = ` ${status} | elapsed ${elapsed}`;
        const fixedWidth = displayWidth(`${label} ||${tail}`);
        const wantedWidth = isFiniteNumber(options.indeterminateWidth) ? options.indeterminateWidth : width - fixedWidth;
        const barWidth = Math.floor(Math.min(Math.max(0, wantedWidth), width - fixedWidth));
        if (barWidth >= 6) {
            const segmentWidth = isFiniteNumber(options.indeterminateSegmentWidth)
                ? options.indeterminateSegmentWidth
                : Math.max(3, Math.floor(barWidth * 0.28));
            const bar = makeIndeterminateBar(barWidth, snapshot.frameIndex, animation, segmentWidth, charset);
            return compactLine(`${label}|${bar}|${tail}`, width);
        }
        if (options.adaptiveLayout !== false) {
            return compactLine(`${label}${spinner} ${status} | elapsed ${elapsed}`, width);
        }
    }
    const candidates = [
        `${label}${spinner} ${status} | elapsed ${elapsed}`,
        `${label}${spinner} ${status}`,
        `${label}${spinner}`,
    ];
    for (const candidate of candidates) {
        if (displayWidth(candidate) <= width) {
            return candidate;
        }
    }
    return compactLine(candidates[candidates.length - 1], width);
}
function buildFinalLine(snapshot, state, message, width) {
    const { options } = snapshot;
    const label = options.label || "flowbar";
    const elapsed = formatDuration(snapshot.timing.elapsedMs);
    const suffix = message ? ` | ${message}` : "";
    const successMarker = colorize(options.charset === "ascii" ? "[OK]" : "✔", 32, options);
    const failureMarker = colorize(options.charset === "ascii" ? "[ERR]" : "✖", 31, options);
    const cancelledMarker = colorize(options.charset === "ascii" ? "[CANCEL]" : "■", 33, options);
    if (state === "success") {
        if (snapshot.total != null) {
            return compactLine(`${successMarker} ${label}  done in ${elapsed} | ${formatAmount(snapshot.current, options.unit)}/${formatAmount(snapshot.total, options.unit)}${suffix}`, width);
        }
        return compactLine(`${successMarker} ${label}  done in ${elapsed}${suffix}`, width);
    }
    if (state === "failure") {
        return compactLine(`${failureMarker} ${label}  failed after ${elapsed}${suffix}`, width);
    }
    if (state === "cancelled") {
        return compactLine(`${cancelledMarker} ${label}  cancelled after ${elapsed}${suffix}`, width);
    }
    return compactLine(`${label}  closed after ${elapsed}${suffix}`, width);
}
function buildLine(snapshot, width) {
    const safeWidth = Math.max(1, Math.floor(width));
    if (snapshot.mode === "determinate") {
        return buildDeterminateLine(snapshot, safeWidth);
    }
    if (snapshot.mode === "counting") {
        return buildCountingLine(snapshot, safeWidth);
    }
    return buildIndeterminateLine(snapshot, safeWidth);
}
class SilentRenderer {
    register() { }
    update() { }
    finalize() { }
    log() { }
    dispose() { }
}
class MemoryRenderer {
    options;
    constructor(options) {
        this.options = options;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, _force = false) {
        const snapshot = bar.snapshot();
        const width = getTerminalWidth(this.options.output, this.options);
        const line = buildLine(snapshot, width);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const width = getTerminalWidth(this.options.output, this.options);
        this.options.onRender?.(buildFinalLine(snapshot, state, message, width), snapshot);
    }
    log(_bar, level, message) {
        this.options.onRender?.(`${level}: ${message}`, undefined);
    }
    dispose() { }
}
class PlainRenderer {
    options;
    lastWriteAt;
    constructor(options) {
        this.options = options;
        this.lastWriteAt = 0;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, force = false) {
        const currentTime = now();
        if (!force && currentTime - this.lastWriteAt < Math.max(1000, this.options.interval * 10)) {
            return;
        }
        this.lastWriteAt = currentTime;
        const snapshot = bar.snapshot();
        const line = buildLine(snapshot, getTerminalWidth(this.options.output, this.options));
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const line = buildFinalLine(snapshot, state, message, getTerminalWidth(this.options.output, this.options));
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    log(_bar, level, message) {
        this.options.output.write(`${level}: ${message}\n`);
        this.options.onRender?.(`${level}: ${message}`, undefined);
    }
    dispose() { }
}
class JsonRenderer {
    options;
    constructor(options) {
        this.options = options;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, _force = false) {
        const snapshot = bar.snapshot();
        const line = JSON.stringify({ type: "progress", snapshot });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const line = JSON.stringify({ type: "final", state, message, snapshot });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    log(_bar, level, message) {
        const line = JSON.stringify({ type: "log", level, message });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, undefined);
    }
    dispose() { }
}
const terminalHubs = new WeakMap();
class TerminalHub {
    output;
    options;
    entries = new Map();
    renderedLineCount = 0;
    disposed = false;
    refCount = 0;
    lastRenderAt = 0;
    resizeHandler;
    constructor(output, options) {
        this.output = output;
        this.options = options;
        this.resizeHandler = () => {
            this.render(true);
        };
        if (typeof output.on === "function") {
            output.on("resize", this.resizeHandler);
        }
    }
    acquire() {
        this.refCount += 1;
    }
    release() {
        this.refCount = Math.max(0, this.refCount - 1);
        if (this.refCount === 0) {
            this.dispose();
            return true;
        }
        return false;
    }
    register(bar) {
        this.entries.set(bar.id, bar);
        this.render(true);
    }
    update(bar, force = false) {
        this.render(force, bar.options.interval);
    }
    finalize(bar, state, message, leave) {
        this.entries.delete(bar.id);
        const width = getTerminalWidth(this.output, bar.options);
        const line = buildFinalLine(bar.snapshot(), state, message, width);
        if (leave) {
            this.safeWriteLine(line, bar.options);
        }
        else {
            this.render(true);
        }
    }
    log(bar, level, message) {
        this.safeWriteLine(`${level}: ${message}`, bar.options);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (typeof this.output.off === "function") {
            this.output.off("resize", this.resizeHandler);
        }
    }
    moveToLiveTop() {
        if (this.renderedLineCount <= 0) {
            return;
        }
        this.output.write("\r");
        if (this.renderedLineCount > 1) {
            this.output.write(`\u001B[${this.renderedLineCount - 1}A`);
        }
    }
    deleteLiveRegion() {
        if (this.renderedLineCount <= 0) {
            return;
        }
        this.moveToLiveTop();
        this.output.write(`\u001B[${this.renderedLineCount}M`);
        this.renderedLineCount = 0;
    }
    safeWriteLine(line, options) {
        this.deleteLiveRegion();
        this.output.write(`${truncateDisplay(line, getTerminalWidth(this.output, options))}\n`);
        this.render(true);
    }
    render(force, interval = this.options.interval) {
        if (this.disposed) {
            return;
        }
        const currentTime = now();
        if (!force && currentTime - this.lastRenderAt < interval) {
            return;
        }
        this.lastRenderAt = currentTime;
        const bars = Array.from(this.entries.values()).filter((bar) => !bar.closed);
        const lines = bars.map((bar) => buildLine(bar.snapshot(), getTerminalWidth(this.output, bar.options)));
        if (lines.length === 0) {
            this.deleteLiveRegion();
            return;
        }
        this.moveToLiveTop();
        const maximumLines = Math.max(this.renderedLineCount, lines.length);
        for (let index = 0; index < maximumLines; index += 1) {
            this.output.write("\u001B[2K");
            if (index < lines.length) {
                this.output.write(lines[index]);
            }
            if (index < maximumLines - 1) {
                this.output.write("\n");
            }
        }
        if (lines.length < maximumLines) {
            this.output.write(`\u001B[${maximumLines - lines.length}A`);
        }
        this.renderedLineCount = lines.length;
    }
}
class TerminalRenderer {
    options;
    hub;
    disposed = false;
    constructor(options) {
        this.options = options;
        let hub = terminalHubs.get(options.output);
        if (!hub) {
            hub = new TerminalHub(options.output, options);
            terminalHubs.set(options.output, hub);
        }
        hub.acquire();
        this.hub = hub;
    }
    register(bar) {
        this.hub.register(bar);
    }
    update(bar, force = false) {
        this.hub.update(bar, force);
    }
    finalize(bar, state, message, leave) {
        this.hub.finalize(bar, state, message, leave);
    }
    log(bar, level, message) {
        this.hub.log(bar, level, message);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.hub.release()) {
            terminalHubs.delete(this.options.output);
        }
    }
}
function isCiEnvironment() {
    return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.GITLAB_CI === "true" || process.env.BITBUCKET_BUILD_NUMBER != null;
}
function createRenderer(options) {
    if (!options.enabled || options.renderer === "silent") {
        return new SilentRenderer();
    }
    if (options.renderer === "memory") {
        return new MemoryRenderer(options);
    }
    if (options.renderer === "json") {
        return new JsonRenderer(options);
    }
    if (options.renderer === "plain") {
        return new PlainRenderer(options);
    }
    if (options.renderer === "terminal") {
        return new TerminalRenderer(options);
    }
    if (options.output?.isTTY && !isCiEnvironment()) {
        return new TerminalRenderer(options);
    }
    return new PlainRenderer(options);
}
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
    lastRateValue;
    ratePerSecond;
    frameIndexValue;
    closedValue;
    renderer;
    abortHandler;
    animationTimer;
    constructor(options = {}) {
        this.id = nextProgressBarId;
        nextProgressBarId += 1;
        this.normalizedOptions = normalizeOptions(options);
        this.currentValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.current, "current") ?? 0;
        this.totalValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.total, "total");
        this.statusValue = this.normalizedOptions.status;
        this.postfixValue = { ...(this.normalizedOptions.postfix || {}) };
        this.startedAtValue = now();
        this.updatedAtValue = this.startedAtValue;
        this.lastRateAt = this.startedAtValue;
        this.lastRateValue = this.currentValue;
        this.ratePerSecond = null;
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
        this.startAnimationIfNeeded();
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
        const currentTime = now();
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
        this.lastRateValue = nextValue;
        this.updatedAtValue = currentTime;
    }
    render(force = false) {
        if (this.closedValue) {
            return;
        }
        this.renderer.update(this, force);
    }
    startAnimationIfNeeded() {
        const interval = this.normalizedOptions.indeterminateInterval || this.normalizedOptions.interval;
        if (!this.normalizedOptions.enabled || this.normalizedOptions.renderer === "silent") {
            return;
        }
        this.animationTimer = setInterval(() => {
            if (this.closedValue) {
                return;
            }
            if (this.getMode() === "indeterminate") {
                this.frameIndexValue += 1;
                this.updatedAtValue = now();
                this.renderer.update(this, true);
            }
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
        const previous = this.currentValue;
        this.currentValue = Math.max(0, this.currentValue + numericDelta);
        this.updateRate(previous, this.currentValue);
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
        this.updatedAtValue = now();
        this.render(true);
        return this;
    }
    setMode(mode) {
        if (this.closedValue) {
            return this;
        }
        this.normalizedOptions.mode = normalizeMode(mode);
        this.updatedAtValue = now();
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
    setPostfix(postfix) {
        if (this.closedValue) {
            return this;
        }
        this.postfixValue = { ...(postfix || {}) };
        this.updatedAtValue = now();
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
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = undefined;
        }
        if (this.normalizedOptions.signal && this.abortHandler) {
            this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
            this.abortHandler = undefined;
        }
        this.renderer.finalize(this, state, safeMessage(message), this.normalizedOptions.leave);
        this.renderer.dispose?.();
        return this;
    }
}
function createProgressBar(options = {}) {
    return new ProgressBar(options);
}
function wrapSyncIterable(input, options = {}) {
    const total = options.total ?? inferTotal(input);
    const bar = createProgressBar({ ...options, total });
    function* generator() {
        let completedNormally = false;
        try {
            for (const item of input) {
                ensureNotAborted(options.signal);
                yield item;
                bar.increment(1);
            }
            completedNormally = true;
            bar.succeed();
        }
        catch (error) {
            if (isAbortErrorLike(error)) {
                bar.cancel("aborted");
            }
            else {
                bar.fail(error);
            }
            throw error;
        }
        finally {
            if (!completedNormally && !bar.closed) {
                bar.close();
            }
        }
    }
    return generator();
}
function wrapAsyncIterable(input, options = {}) {
    const total = options.total ?? inferTotal(input);
    const bar = createProgressBar({ ...options, total });
    async function* generator() {
        let completedNormally = false;
        try {
            for await (const item of input) {
                ensureNotAborted(options.signal);
                yield item;
                bar.increment(1);
            }
            completedNormally = true;
            bar.succeed();
        }
        catch (error) {
            if (isAbortErrorLike(error)) {
                bar.cancel("aborted");
            }
            else {
                bar.fail(error);
            }
            throw error;
        }
        finally {
            if (!completedNormally && !bar.closed) {
                bar.close();
            }
        }
    }
    return generator();
}
function flowbar(input, options = {}) {
    if (isAsyncIterable(input)) {
        return wrapAsyncIterable(input, options);
    }
    if (isIterable(input)) {
        return wrapSyncIterable(input, options);
    }
    throw new TypeError("flowbar(input) expects an Iterable or AsyncIterable input.");
}
function toAsyncIterator(input) {
    if (isAsyncIterable(input)) {
        return input[Symbol.asyncIterator]();
    }
    if (isIterable(input)) {
        const iterator = input[Symbol.iterator]();
        return {
            async next() {
                return iterator.next();
            },
            async return(value) {
                if (typeof iterator.return === "function") {
                    return iterator.return(value);
                }
                return { done: true, value: value };
            },
        };
    }
    throw new TypeError("Expected an Iterable or AsyncIterable input.");
}
async function closeIterator(iterator) {
    if (typeof iterator.return === "function") {
        await iterator.return();
    }
}
async function runWithProgress(input, handler, options, collectResults) {
    const total = options.total ?? inferTotal(input);
    const concurrency = normalizeConcurrency(options.concurrency);
    const bar = createProgressBar({ ...options, total });
    const iterator = toAsyncIterator(input);
    const results = [];
    let nextIndex = 0;
    let iteratorLock = Promise.resolve();
    let stopped = false;
    async function nextItem() {
        const run = iteratorLock.then(async () => {
            if (stopped) {
                return { done: true, value: undefined, index: -1 };
            }
            ensureNotAborted(options.signal);
            const index = nextIndex;
            const result = await iterator.next();
            if (result.done) {
                return { done: true, value: undefined, index: -1 };
            }
            nextIndex += 1;
            return { done: false, value: result.value, index };
        });
        iteratorLock = run.catch(() => undefined);
        return run;
    }
    async function worker() {
        for (;;) {
            const item = await nextItem();
            if (item.done) {
                return;
            }
            const mapped = await handler(item.value, item.index, bar);
            if (collectResults) {
                results[item.index] = mapped;
            }
            bar.increment(1);
        }
    }
    try {
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        bar.succeed();
        return collectResults ? results : undefined;
    }
    catch (error) {
        stopped = true;
        await closeIterator(iterator);
        if (isAbortErrorLike(error)) {
            bar.cancel("aborted");
        }
        else {
            bar.fail(error);
        }
        throw error;
    }
}
async function mapWithProgress(input, mapper, options = {}) {
    if (typeof mapper !== "function") {
        throw new TypeError("flowbar.map(input, mapper) expects mapper to be a function.");
    }
    return runWithProgress(input, mapper, options, true);
}
async function eachWithProgress(input, handler, options = {}) {
    if (typeof handler !== "function") {
        throw new TypeError("flowbar.each(input, handler) expects handler to be a function.");
    }
    await runWithProgress(input, handler, options, false);
}
function streamWithProgress(options = {}) {
    const bar = createProgressBar({ ...options, unit: options.unit || "byte" });
    const unit = bar.options.unit;
    const transform = new Transform({
        transform(chunk, _encoding, callback) {
            try {
                const amount = unit === "byte" && chunk != null && typeof chunk === "object" && "length" in chunk && isFiniteNumber(chunk.length) ? chunk.length : 1;
                bar.increment(amount);
                callback(null, chunk);
            }
            catch (error) {
                bar.fail(error);
                callback(error instanceof Error ? error : new Error(String(error)));
            }
        },
        flush(callback) {
            try {
                bar.succeed();
                callback();
            }
            catch (error) {
                callback(error instanceof Error ? error : new Error(String(error)));
            }
        },
    });
    transform.flowbar = bar;
    transform.on("error", (error) => {
        if (!bar.closed) {
            bar.fail(error);
        }
    });
    transform.on("close", () => {
        if (!bar.closed) {
            bar.close();
        }
    });
    return transform;
}
function createGroup(options = {}) {
    const groupOptions = { ...options };
    const bars = new Set();
    function track(bar) {
        bars.add(bar);
        return bar;
    }
    return {
        create(childOptions = {}) {
            const label = childOptions.label || groupOptions.label;
            return track(createProgressBar({ ...groupOptions, ...childOptions, label }));
        },
        wait(childOptions = {}) {
            return track(createProgressBar({ ...groupOptions, ...childOptions, mode: "indeterminate" }));
        },
        close() {
            for (const bar of bars) {
                if (!bar.closed) {
                    bar.close("group closed");
                }
            }
            bars.clear();
        },
    };
}
async function task(label, handler, options = {}) {
    const root = createProgressBar({ ...options, label, mode: "indeterminate", status: options.status || "running" });
    const taskApi = {
        bar: root,
        async step(stepLabel, stepHandler) {
            root.setStatus(stepLabel);
            return stepHandler(root);
        },
        async indeterminate(stepLabel, stepHandler) {
            root.setMode("indeterminate");
            root.setStatus(stepLabel);
            return stepHandler(root);
        },
        async progress(stepLabel, items, itemHandler, progressOptions = {}) {
            root.close();
            return eachWithProgress(items, itemHandler, { ...options, ...progressOptions, label: stepLabel });
        },
    };
    try {
        const result = await handler(taskApi);
        if (!root.closed) {
            root.succeed();
        }
        return result;
    }
    catch (error) {
        if (!root.closed) {
            root.fail(error);
        }
        throw error;
    }
}
export function configure(defaultOptions = {}) {
    const configured = function configuredFlowbar(input, options = {}) {
        return flowbar(input, { ...defaultOptions, ...options });
    };
    configured.create = (options = {}) => createProgressBar({ ...defaultOptions, ...options });
    configured.wait = (options = {}) => createProgressBar({ ...defaultOptions, ...options, mode: "indeterminate" });
    configured.indeterminate = configured.wait;
    configured.spinner = configured.wait;
    configured.map = (input, mapper, options = {}) => mapWithProgress(input, mapper, { ...defaultOptions, ...options });
    configured.each = (input, handler, options = {}) => eachWithProgress(input, handler, { ...defaultOptions, ...options });
    configured.stream = (options = {}) => streamWithProgress({ ...defaultOptions, ...options });
    configured.group = (options = {}) => createGroup({ ...defaultOptions, ...options });
    configured.task = (label, handler, options = {}) => task(label, handler, { ...defaultOptions, ...options });
    configured.configure = (options = {}) => configure({ ...defaultOptions, ...options });
    return configured;
}
const flowbarApi = flowbar;
flowbarApi.create = createProgressBar;
flowbarApi.wait = (options = {}) => createProgressBar({ ...options, mode: "indeterminate" });
flowbarApi.indeterminate = flowbarApi.wait;
flowbarApi.spinner = flowbarApi.wait;
flowbarApi.map = mapWithProgress;
flowbarApi.each = eachWithProgress;
flowbarApi.stream = streamWithProgress;
flowbarApi.group = createGroup;
flowbarApi.task = task;
flowbarApi.configure = configure;
flowbarApi.ProgressBar = ProgressBar;
export default flowbarApi;
