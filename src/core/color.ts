import type { FlowbarColorMode, FlowbarColorName, WritableLike } from "../types.js";

const ANSI_CODES: Record<FlowbarColorName, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  "bright-black": 90,
  "bright-red": 91,
  "bright-green": 92,
  "bright-yellow": 93,
  "bright-blue": 94,
  "bright-magenta": 95,
  "bright-cyan": 96,
  "bright-white": 97,
};

export function isColorName(value: unknown): value is FlowbarColorName {
  return typeof value === "string" && value in ANSI_CODES;
}

function forcedColor(): boolean | undefined {
  const value = process.env.FORCE_COLOR;
  if (value == null) {
    return undefined;
  }
  return value !== "0" && value !== "false";
}

function supportsColor(output: WritableLike): boolean {
  const forced = forcedColor();
  if (forced != null) {
    return forced;
  }
  if (process.env.NO_COLOR != null || process.env.TERM === "dumb") {
    return false;
  }
  return output.isTTY === true;
}

function hasLightBackground(): boolean {
  const override = process.env.FLOWBAR_BACKGROUND?.toLowerCase();
  if (override === "light") {
    return true;
  }
  if (override === "dark") {
    return false;
  }
  const backgroundCode = Number(process.env.COLORFGBG?.split(";").at(-1));
  return Number.isFinite(backgroundCode) && (backgroundCode === 7 || backgroundCode >= 9);
}

export function resolveColor(color: FlowbarColorMode | undefined, output: WritableLike): false | FlowbarColorName {
  if (color == null || color === false) {
    return false;
  }
  if (color === true) {
    return "cyan";
  }
  if (color === "auto") {
    if (!supportsColor(output)) {
      return false;
    }
    return hasLightBackground() ? "blue" : "cyan";
  }
  if (isColorName(color)) {
    return color;
  }
  throw new TypeError('color must be false, true, "auto", or a supported ANSI color name.');
}

export function colorize(value: string, color: false | FlowbarColorName): string {
  if (color === false || value.length === 0) {
    return value;
  }
  return `\u001B[${ANSI_CODES[color]}m${value}\u001B[0m`;
}
