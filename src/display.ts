import type { FlowbarUnit } from "./types.js";

export function stripAnsi(value: unknown): string {
  return String(value).replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
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
  for (const char of plain) {
    width += codePointWidth(char.codePointAt(0) ?? 0);
  }
  return width;
}

export function readAnsiSequence(text: string, start: number): string | undefined {
  const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
  return match?.[0];
}

export function truncateDisplay(value: unknown, maxWidth: number): string {
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
  for (let index = 0; index < text.length; ) {
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
