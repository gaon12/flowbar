import { stripVTControlCharacters } from "node:util";
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const sgrPattern = /(\u001B\[[0-9;:]*m)/g;
/** Keep styling, but never let user text move the terminal cursor. */
export function singleLine(value) {
    return String(value)
        .split(sgrPattern)
        .map((part) => /^\u001B\[[0-9;:]*m$/.test(part)
        ? part
        : stripAnsi(part).replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " "))
        .join("");
}
export function stripAnsi(value) {
    return stripVTControlCharacters(String(value));
}
export function isZeroWidthCodePoint(codePoint) {
    return (codePoint === 0x200d ||
        (codePoint >= 0x0300 && codePoint <= 0x036f) ||
        (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
        (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
        (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
        (codePoint >= 0xfe00 && codePoint <= 0xfe0f));
}
export function codePointWidth(codePoint) {
    if (codePoint === 0) {
        return 0;
    }
    if (isZeroWidthCodePoint(codePoint) ||
        codePoint < 32 ||
        (codePoint >= 0x7f && codePoint < 0xa0)) {
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
    for (const { segment } of segmenter.segment(plain)) {
        width += graphemeWidth(segment);
    }
    return width;
}
function graphemeWidth(segment) {
    if (/\p{Emoji_Presentation}|\p{Regional_Indicator}|\uFE0F|\u20E3/u.test(segment))
        return 2;
    let width = 0;
    for (const char of segment) {
        if (!/\p{Mark}/u.test(char))
            width = Math.max(width, codePointWidth(char.codePointAt(0) ?? 0));
    }
    return width;
}
export function readAnsiSequence(text, start) {
    const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
    return match?.[0];
}
export function truncateDisplay(value, maxWidth, ellipsis = "…") {
    const text = singleLine(value);
    if (maxWidth <= 0) {
        return "";
    }
    if (displayWidth(text) <= maxWidth) {
        return text;
    }
    if (maxWidth === 1) {
        return ellipsis;
    }
    let result = "";
    let width = 0;
    const targetWidth = Math.max(0, maxWidth - 1);
    outer: for (const part of text.split(sgrPattern)) {
        if (/^\u001B\[[0-9;:]*m$/.test(part)) {
            result += part;
        }
        else {
            for (const { segment } of segmenter.segment(part)) {
                const charWidth = graphemeWidth(segment);
                if (width + charWidth > targetWidth)
                    break outer;
                result += segment;
                width += charWidth;
            }
        }
    }
    return `${result}${ellipsis}${result.includes("\u001B[") ? "\u001B[0m" : ""}`;
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
