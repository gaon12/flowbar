"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFinalLine = buildFinalLine;
exports.buildLine = buildLine;
const color_js_1 = require("../core/color.js");
const utils_js_1 = require("../core/utils.js");
function emptyBarCharacter(charset, barTrack) {
    if (barTrack === "blank") {
        return " ";
    }
    return charset === "ascii" ? "-" : "░";
}
function makeBar(width, ratio, charset, barTrack, color) {
    const safeWidth = Math.max(0, Math.floor(width));
    const safeRatio = (0, utils_js_1.clampNumber)(Number.isFinite(ratio) ? ratio : 0, 0, 1);
    const filledCount = Math.round(safeWidth * safeRatio);
    const full = charset === "ascii" ? "#" : "█";
    const empty = emptyBarCharacter(charset, barTrack);
    return `${(0, color_js_1.colorize)(full.repeat(filledCount), color)}${empty.repeat(Math.max(0, safeWidth - filledCount))}`;
}
function makeIndeterminateBar(width, frameIndex, style, segmentWidth, charset, barTrack, color) {
    const safeWidth = Math.max(1, Math.floor(width));
    const full = charset === "ascii" ? "#" : "█";
    const empty = emptyBarCharacter(charset, barTrack);
    const segment = (0, utils_js_1.clampNumber)(Math.floor(segmentWidth || Math.max(3, safeWidth * 0.28)), 1, safeWidth);
    const chars = Array.from({ length: safeWidth }, () => empty);
    if (style === "pulse") {
        const maxSegment = safeWidth;
        const minSegment = Math.min(segment, maxSegment);
        const cycle = Math.max(1, (maxSegment - minSegment) * 2);
        const step = frameIndex % cycle;
        const size = step <= maxSegment - minSegment ? minSegment + step : maxSegment - (step - (maxSegment - minSegment));
        const start = Math.floor((safeWidth - size) / 2);
        for (let index = start; index < start + size; index += 1) {
            chars[index] = full;
        }
        return (0, color_js_1.colorize)(chars.join(""), color);
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
        return (0, color_js_1.colorize)(chars.join(""), color);
    }
    const cycle = safeWidth + segment;
    const position = (frameIndex % cycle) - segment;
    for (let index = position; index < position + segment; index += 1) {
        if (index >= 0 && index < chars.length) {
            chars[index] = full;
        }
    }
    return (0, color_js_1.colorize)(chars.join(""), color);
}
function compactLine(line, width) {
    return (0, utils_js_1.truncateDisplay)(line.replace(/\s+/g, " ").trim(), width);
}
function padDisplayLeft(value, width) {
    const padding = Math.max(0, width - (0, utils_js_1.displayWidth)(value));
    return `${" ".repeat(padding)}${value}`;
}
function colorizeStatus(value, color, options) {
    if (!options.color) {
        return value;
    }
    return (0, color_js_1.colorize)(value, color);
}
function buildDeterminateLine(snapshot, width) {
    const { options } = snapshot;
    const current = Math.max(0, snapshot.current);
    const total = Math.max(0, snapshot.total || 0);
    const ratio = total === 0 ? 1 : (0, utils_js_1.clampNumber)(current / total, 0, 1);
    const percent = `${(0, utils_js_1.padLeft)(Math.floor(ratio * 100), 3)}%`;
    const label = options.label ? `${options.label}  ` : "";
    const currentAmount = (0, utils_js_1.formatAmount)(current, options.unit);
    const totalAmount = (0, utils_js_1.formatAmount)(total, options.unit);
    const countWidth = Math.max((0, utils_js_1.displayWidth)(`${currentAmount}/${totalAmount}`), (0, utils_js_1.displayWidth)(`${totalAmount}/${totalAmount}`));
    const count = `${padDisplayLeft(currentAmount, Math.max(0, countWidth - (0, utils_js_1.displayWidth)(`/${totalAmount}`)))}/${totalAmount}`;
    const elapsed = (0, utils_js_1.formatDuration)(snapshot.timing.elapsedMs);
    const remaining = snapshot.timing.remainingMs == null ? "--:--" : (0, utils_js_1.formatDuration)(snapshot.timing.remainingMs);
    const rate = (0, utils_js_1.formatRate)(snapshot.timing.ratePerSecond || 0, options.unit);
    const postfix = (0, utils_js_1.stringifyPostfix)(snapshot.postfix);
    const charset = options.charset;
    if (options.preset === "minimal") {
        return compactLine(`${label}${percent} ${count}`, width);
    }
    const postfixTail = postfix ? ` ${postfix}` : "";
    const tailCandidates = [];
    if (options.preset === "verbose") {
        tailCandidates.push(` ${count} elapsed ${elapsed} remaining ${remaining} ${rate}${postfixTail}`);
        tailCandidates.push(` ${count} elapsed ${elapsed} remaining ${remaining} ${rate}`);
        tailCandidates.push(` ${count} elapsed ${elapsed} remaining ${remaining}`);
        tailCandidates.push(` elapsed ${elapsed} remaining ${remaining}`);
    }
    else if (options.preset === "compact") {
        tailCandidates.push(` ${count} ${elapsed}<${remaining}${postfixTail}`);
        tailCandidates.push(` ${count} ${elapsed}<${remaining}`);
        tailCandidates.push(` ${elapsed}<${remaining}`);
    }
    else {
        tailCandidates.push(` ${count} [${elapsed}<${remaining}, ${rate}]${postfixTail}`);
        tailCandidates.push(` ${count} [${elapsed}<${remaining}, ${rate}]`);
        tailCandidates.push(` ${count} [${elapsed}<${remaining}]`);
        tailCandidates.push(` [${elapsed}<${remaining}]`);
    }
    tailCandidates.push(` ${count}`);
    tailCandidates.push("");
    const prefix = `${label}${percent} |`;
    const suffix = "|";
    const fixedWidth = (0, utils_js_1.displayWidth)(`${prefix}${suffix}`);
    for (const tail of tailCandidates) {
        const barWidth = width - fixedWidth - (0, utils_js_1.displayWidth)(tail);
        if (barWidth >= 6) {
            const bar = makeBar(barWidth, ratio, charset, options.barTrack, options.color);
            return `${prefix}${bar}${suffix}${tail}`;
        }
    }
    return compactLine(`${label}${percent} ${count}`, width);
}
function buildCountingLine(snapshot, width) {
    const { options } = snapshot;
    const label = options.label ? `${options.label}  ` : "";
    const unit = (0, utils_js_1.pluralizeUnit)(options.unit || "item", snapshot.current);
    const count = options.unit === "byte" ? (0, utils_js_1.formatBytes)(snapshot.current) : `${(0, utils_js_1.formatAmount)(snapshot.current, options.unit)} ${unit}`;
    const elapsed = (0, utils_js_1.formatDuration)(snapshot.timing.elapsedMs);
    const rate = (0, utils_js_1.formatRate)(snapshot.timing.ratePerSecond || 0, options.unit);
    const postfix = (0, utils_js_1.stringifyPostfix)(snapshot.postfix);
    const candidates = [
        `${label}${count} | elapsed ${elapsed} | ${rate}${postfix ? ` | ${postfix}` : ""}`,
        `${label}${count} | ${elapsed} | ${rate}`,
        `${label}${count} | ${elapsed}`,
        `${label}${count}`,
    ];
    for (const candidate of candidates) {
        if ((0, utils_js_1.displayWidth)(candidate) <= width) {
            return candidate;
        }
    }
    return compactLine(candidates[candidates.length - 1], width);
}
function buildIndeterminateLine(snapshot, width) {
    const { options } = snapshot;
    const label = options.label ? `${options.label}  ` : "";
    const elapsed = (0, utils_js_1.formatDuration)(snapshot.timing.elapsedMs);
    const status = snapshot.status || options.status || "running";
    const charset = options.charset;
    const frames = options.spinnerFrames || (charset === "ascii" ? utils_js_1.DEFAULT_SPINNER_ASCII : utils_js_1.DEFAULT_SPINNER_UNICODE);
    const spinner = frames[snapshot.frameIndex % frames.length];
    const animation = options.animation || "spinner";
    if (animation !== "spinner") {
        const tail = ` ${status} | elapsed ${elapsed}`;
        const fixedWidth = (0, utils_js_1.displayWidth)(`${label} ||${tail}`);
        const wantedWidth = (0, utils_js_1.isFiniteNumber)(options.indeterminateWidth) ? options.indeterminateWidth : width - fixedWidth;
        const barWidth = Math.floor(Math.min(Math.max(0, wantedWidth), width - fixedWidth));
        if (barWidth >= 6) {
            const segmentWidth = (0, utils_js_1.isFiniteNumber)(options.indeterminateSegmentWidth)
                ? options.indeterminateSegmentWidth
                : Math.max(3, Math.floor(barWidth * 0.28));
            const bar = makeIndeterminateBar(barWidth, snapshot.frameIndex, animation, segmentWidth, charset, options.barTrack, options.color);
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
        if ((0, utils_js_1.displayWidth)(candidate) <= width) {
            return candidate;
        }
    }
    return compactLine(candidates[candidates.length - 1], width);
}
function buildFinalLine(snapshot, state, message, width) {
    const { options } = snapshot;
    const label = options.label || "flowbar";
    const elapsed = (0, utils_js_1.formatDuration)(snapshot.timing.elapsedMs);
    const suffix = message ? ` | ${message}` : "";
    const successMarker = colorizeStatus(options.charset === "ascii" ? "[OK]" : "✔", "green", options);
    const failureMarker = colorizeStatus(options.charset === "ascii" ? "[ERR]" : "✖", "red", options);
    const cancelledMarker = colorizeStatus(options.charset === "ascii" ? "[CANCEL]" : "■", "yellow", options);
    if (state === "success") {
        if (snapshot.total != null) {
            return compactLine(`${successMarker} ${label}  done in ${elapsed} | ${(0, utils_js_1.formatAmount)(snapshot.current, options.unit)}/${(0, utils_js_1.formatAmount)(snapshot.total, options.unit)}${suffix}`, width);
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
