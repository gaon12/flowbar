import { stripVTControlCharacters } from "node:util";
import type { FlowbarUnit } from "./types.js";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const sgrPattern = /(\u001B\[[0-9;:]*m)/g;

/** Keep styling, but never let user text move the terminal cursor. */
export function singleLine(value: unknown): string {
  return String(value)
    .split(sgrPattern)
    .map((part) =>
      /^\u001B\[[0-9;:]*m$/.test(part)
        ? part
        : stripAnsi(part).replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " "),
    )
    .join("");
}

export function stripAnsi(value: unknown): string {
  return stripVTControlCharacters(String(value));
}

export function isZeroWidthCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x200d ||
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
  );
}

export function codePointWidth(codePoint: number): number {
  if (codePoint === 0) {
    return 0;
  }
  if (
    isZeroWidthCodePoint(codePoint) ||
    codePoint < 32 ||
    (codePoint >= 0x7f && codePoint < 0xa0)
  ) {
    return 0;
  }
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  ) {
    return 2;
  }
  return 1;
}

export function displayWidth(value: unknown): number {
  const plain = stripAnsi(value);
  let width = 0;
  for (const { segment } of segmenter.segment(plain)) {
    width += graphemeWidth(segment);
  }
  return width;
}

function graphemeWidth(segment: string): number {
  // Windows ConPTY accounts for joined emoji as separate wide code points even
  // when the terminal font draws a single glyph. Reserve those cells to avoid wrapping.
  if (process.platform === "win32" && segment.includes("\u200d")) {
    return [...segment].reduce(
      (width, char) => width + codePointWidth(char.codePointAt(0) ?? 0),
      0,
    );
  }
  if (/\p{Emoji_Presentation}|\p{Regional_Indicator}|\uFE0F|\u20E3/u.test(segment)) return 2;
  let width = 0;
  for (const char of segment) {
    if (!/\p{Mark}/u.test(char)) width = Math.max(width, codePointWidth(char.codePointAt(0) ?? 0));
  }
  return width;
}

export function readAnsiSequence(text: string, start: number): string | undefined {
  const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
  return match?.[0];
}

export function truncateDisplay(value: unknown, maxWidth: number, ellipsis = "…"): string {
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
    } else {
      for (const { segment } of segmenter.segment(part)) {
        const charWidth = graphemeWidth(segment);
        if (width + charWidth > targetWidth) break outer;
        result += segment;
        width += charWidth;
      }
    }
  }
  return `${result}${ellipsis}${result.includes("\u001B[") ? "\u001B[0m" : ""}`;
}

export function padLeft(value: unknown, width: number, fill = " "): string {
  const text = String(value);
  return `${fill.repeat(Math.max(0, width - text.length))}${text}`;
}

export function formatDuration(milliseconds: number): string {
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

export function formatNumber(value: number): string {
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

export function formatBytes(value: number): string {
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

export function pluralizeUnit(unit: string, value: number): string {
  if (!unit || unit === "byte") {
    return unit || "item";
  }
  if (Math.abs(value) === 1 || unit.endsWith("s")) {
    return unit;
  }
  return `${unit}s`;
}

export function formatAmount(value: number, unit: FlowbarUnit): string {
  if (unit === "byte") {
    return formatBytes(value);
  }
  return formatNumber(value);
}

export function formatRate(rate: number, unit: FlowbarUnit): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "?";
  }
  if (unit === "byte") {
    return `${formatBytes(rate)}/s`;
  }
  return `${formatNumber(rate)} ${pluralizeUnit(unit || "item", rate)}/s`;
}

export function stringifyPostfix(postfix: Record<string, unknown>): string {
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
