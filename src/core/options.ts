import type {
  FlowbarAnimation,
  FlowbarMode,
  FlowbarOptions,
  FlowbarPreset,
  RequiredNormalizedFlowbarOptions,
  WritableLike,
} from "../types.js";
import { cloneData } from "./snapshot.js";
import {
  assertFiniteNumber,
  chooseCharset,
  clampNumber,
  DEFAULT_INTERVAL_MS,
  DEFAULT_MIN_ETA_ELAPSED_MS,
  DEFAULT_RATE_SMOOTHING,
  DEFAULT_TERMINAL_WIDTH,
  isFiniteNumber,
} from "./utils.js";

export const MAX_CONCURRENCY = 1024;

export function normalizeMode(mode: unknown): FlowbarMode {
  if (mode == null || mode === "") {
    return "auto";
  }
  if (mode === "auto" || mode === "determinate" || mode === "counting" || mode === "indeterminate") {
    return mode;
  }
  throw new TypeError(`mode must be one of "auto", "determinate", "counting", or "indeterminate".`);
}

export function normalizeAnimation(animation: unknown): FlowbarAnimation {
  if (animation == null || animation === "") {
    return "spinner";
  }
  if (animation === "spinner" || animation === "marquee" || animation === "bounce" || animation === "pulse") {
    return animation;
  }
  throw new TypeError(`animation must be one of "spinner", "marquee", "bounce", or "pulse".`);
}

export function normalizePreset(preset: unknown): FlowbarPreset {
  if (preset == null || preset === "") {
    return "tqdm";
  }
  if (preset === "tqdm" || preset === "compact" || preset === "verbose" || preset === "minimal") {
    return preset;
  }
  throw new TypeError(`preset must be one of "tqdm", "compact", "verbose", or "minimal".`);
}

export function normalizeConcurrency(value: unknown): number {
  if (value == null) {
    return 1;
  }
  const concurrency = assertFiniteNumber(value, "concurrency");
  if (!Number.isInteger(concurrency)) {
    throw new RangeError("concurrency must be an integer.");
  }
  if (concurrency < 1) {
    throw new RangeError("concurrency must be greater than or equal to 1.");
  }
  if (concurrency > MAX_CONCURRENCY) {
    throw new RangeError(`concurrency must be less than or equal to ${MAX_CONCURRENCY}.`);
  }
  return concurrency;
}

export function normalizeOptions(options: FlowbarOptions = {}): RequiredNormalizedFlowbarOptions {
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
    postfix: options.postfix ? cloneData(options.postfix) : undefined,
    spinnerFrames:
      Array.isArray(options.spinnerFrames) && options.spinnerFrames.length > 0
        ? options.spinnerFrames.map(String)
        : undefined,
  };
}

export function getTerminalWidth(output: WritableLike, options: RequiredNormalizedFlowbarOptions): number {
  if (isFiniteNumber(options.width) && options.width > 0) {
    return Math.floor(options.width);
  }
  if (options.dynamicWidth !== false && isFiniteNumber(output?.columns)) {
    return Math.max(1, Math.floor(output.columns - options.wrapGuardColumns));
  }
  return Math.max(1, DEFAULT_TERMINAL_WIDTH - options.wrapGuardColumns);
}
