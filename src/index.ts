/**
 * flowbar TypeScript source.
 *
 * 패키지는 zero runtime dependency를 유지하기 위해 Node.js core API만 사용합니다.
 */
import { Transform } from "node:stream";
import { performance } from "node:perf_hooks";

export type FlowbarMode = "auto" | "determinate" | "counting" | "indeterminate";
export type FlowbarAnimation = "spinner" | "marquee" | "bounce" | "pulse";
export type FlowbarRendererName = "auto" | "terminal" | "plain" | "silent" | "json" | "memory";
export type FlowbarCharset = "auto" | "unicode" | "ascii";
export type FlowbarPreset = "tqdm" | "compact" | "verbose" | "minimal";
export type FlowbarUnit = "item" | "byte" | string;

export type WritableLike = {
  readonly isTTY?: boolean;
  readonly columns?: number;
  write(chunk: string): unknown;
  on?(eventName: "resize", listener: () => void): unknown;
  off?(eventName: "resize", listener: () => void): unknown;
};

export type FlowbarTiming = {
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly elapsedMs: number;
  readonly remainingMs: number | null;
  readonly etaAt: number | null;
  readonly ratePerSecond: number | null;
};

export type FlowbarSnapshot = {
  readonly id: number;
  readonly current: number;
  readonly total: number | undefined;
  readonly mode: Exclude<FlowbarMode, "auto">;
  readonly status: string;
  readonly postfix: Record<string, unknown>;
  readonly frameIndex: number;
  readonly options: Readonly<RequiredNormalizedFlowbarOptions>;
  readonly timing: FlowbarTiming;
};

export type FlowbarRenderCallback = (line: string, snapshot: FlowbarSnapshot | undefined) => void;

export type FlowbarOptions = {
  label?: string;
  total?: number;
  current?: number;
  unit?: FlowbarUnit;
  mode?: FlowbarMode;
  status?: string;
  animation?: FlowbarAnimation;
  indeterminateStyle?: FlowbarAnimation;
  indeterminateWidth?: number;
  indeterminateSegmentWidth?: number;
  indeterminateInterval?: number;
  enabled?: boolean;
  renderer?: FlowbarRendererName;
  output?: WritableLike;
  interval?: number;
  width?: number;
  dynamicWidth?: boolean;
  wrapGuardColumns?: number;
  adaptiveLayout?: boolean;
  leave?: boolean;
  color?: boolean;
  charset?: FlowbarCharset;
  signal?: AbortSignal;
  postfix?: Record<string, unknown>;
  preset?: FlowbarPreset;
  spinnerFrames?: readonly string[];
  rateSmoothing?: number;
  minElapsedMsForEta?: number;
  onRender?: FlowbarRenderCallback;
};

export type RequiredNormalizedFlowbarOptions = FlowbarOptions & {
  output: WritableLike;
  renderer: FlowbarRendererName;
  unit: FlowbarUnit;
  interval: number;
  mode: FlowbarMode;
  preset: FlowbarPreset;
  animation: FlowbarAnimation;
  status: string;
  enabled: boolean;
  leave: boolean;
  color: boolean;
  dynamicWidth: boolean;
  adaptiveLayout: boolean;
  wrapGuardColumns: number;
  rateSmoothing: number;
  minElapsedMsForEta: number;
  charset: Exclude<FlowbarCharset, "auto">;
  signal?: AbortSignal;
  onRender?: FlowbarRenderCallback;
  spinnerFrames?: string[];
};

export type FlowbarMapOptions = FlowbarOptions & {
  concurrency?: number;
};

export type FlowbarMapper<T, R> = (item: T, index: number, bar: ProgressBar) => R | Promise<R>;
export type FlowbarHandler<T> = (item: T, index: number, bar: ProgressBar) => void | Promise<void>;

export type FlowbarGroup = {
  create(options?: FlowbarOptions): ProgressBar;
  wait(options?: FlowbarOptions): ProgressBar;
  close(): void;
};

export type FlowbarTaskApi = {
  readonly bar: ProgressBar;
  step<T>(label: string, handler: (bar: ProgressBar) => T | Promise<T>): Promise<T>;
  indeterminate<T>(label: string, handler: (bar: ProgressBar) => T | Promise<T>): Promise<T>;
  progress<T>(label: string, items: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options?: FlowbarMapOptions): Promise<void>;
};

export interface FlowbarFunction {
  <T>(input: Iterable<T>, options?: FlowbarOptions): Iterable<T>;
  <T>(input: AsyncIterable<T>, options?: FlowbarOptions): AsyncIterable<T>;
  create(options?: FlowbarOptions): ProgressBar;
  wait(options?: FlowbarOptions): ProgressBar;
  indeterminate(options?: FlowbarOptions): ProgressBar;
  spinner(options?: FlowbarOptions): ProgressBar;
  map<T, R>(input: Iterable<T> | AsyncIterable<T>, mapper: FlowbarMapper<T, R>, options?: FlowbarMapOptions): Promise<R[]>;
  each<T>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options?: FlowbarMapOptions): Promise<void>;
  stream(options?: FlowbarOptions): Transform & { flowbar: ProgressBar };
  group(options?: FlowbarOptions): FlowbarGroup;
  task<T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options?: FlowbarOptions): Promise<T>;
  configure(defaultOptions?: FlowbarOptions): FlowbarFunction;
  ProgressBar: typeof ProgressBar;
}

type RendererFinishState = "success" | "failure" | "cancelled" | "closed";
export type FlowbarCloseOptions = {
  leave?: boolean;
};

type Renderer = {
  register(bar: ProgressBar): void;
  update(bar: ProgressBar, force?: boolean): void;
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
  log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
  dispose(): void;
};

type AsyncIteratorLike<T> = AsyncIterator<T> & {
  return?(value?: unknown): Promise<IteratorResult<T>> | IteratorResult<T>;
};

type WorkItem<T> = { done: true; value: undefined; index: -1 } | { done: false; value: T; index: number };

const DEFAULT_SPINNER_UNICODE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const DEFAULT_SPINNER_ASCII = ["-", "\\", "|", "/"];
const DEFAULT_TERMINAL_WIDTH = 80;
const DEFAULT_INTERVAL_MS = 80;
const DEFAULT_RATE_SMOOTHING = 0.85;
const DEFAULT_MIN_ETA_ELAPSED_MS = 500;
let nextProgressBarId = 1;

function now(): number {
  return performance.now();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  if (value < minimum) {
    return minimum;
  }
  if (value > maximum) {
    return maximum;
  }
  return value;
}

function isAbortErrorLike(error: unknown): error is { name: "AbortError" } {
  return error != null && typeof error === "object" && "name" in error && error.name === "AbortError";
}

function makeAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function ensureNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw makeAbortError();
  }
}

function isAsyncIterable<T = unknown>(value: unknown): value is AsyncIterable<T> {
  return value != null && typeof (value as Partial<AsyncIterable<T>>)[Symbol.asyncIterator] === "function";
}

function isIterable<T = unknown>(value: unknown): value is Iterable<T> {
  return value != null && typeof (value as Partial<Iterable<T>>)[Symbol.iterator] === "function";
}

function inferTotal(input: unknown): number | undefined {
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

function chooseCharset(options: FlowbarOptions, output: WritableLike): Exclude<FlowbarCharset, "auto"> {
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

function stripAnsi(value: unknown): string {
  return String(value).replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function isZeroWidthCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x200d ||
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
  );
}

function codePointWidth(codePoint: number): number {
  if (codePoint === 0) {
    return 0;
  }
  if (isZeroWidthCodePoint(codePoint) || codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) {
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

function displayWidth(value: unknown): number {
  const plain = stripAnsi(value);
  let width = 0;
  for (const char of plain) {
    width += codePointWidth(char.codePointAt(0) ?? 0);
  }
  return width;
}

function readAnsiSequence(text: string, start: number): string | undefined {
  const match = /^\u001B\[[0-?]*[ -/]*[@-~]/.exec(text.slice(start));
  return match?.[0];
}

function truncateDisplay(value: unknown, maxWidth: number): string {
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

function padLeft(value: unknown, width: number, fill = " "): string {
  const text = String(value);
  return `${fill.repeat(Math.max(0, width - text.length))}${text}`;
}

function formatDuration(milliseconds: number): string {
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

function formatNumber(value: number): string {
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

function formatBytes(value: number): string {
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

function pluralizeUnit(unit: string, value: number): string {
  if (!unit || unit === "byte") {
    return unit || "item";
  }
  if (Math.abs(value) === 1 || unit.endsWith("s")) {
    return unit;
  }
  return `${unit}s`;
}

function formatAmount(value: number, unit: FlowbarUnit): string {
  if (unit === "byte") {
    return formatBytes(value);
  }
  return formatNumber(value);
}

function formatRate(rate: number, unit: FlowbarUnit): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "?";
  }
  if (unit === "byte") {
    return `${formatBytes(rate)}/s`;
  }
  return `${formatNumber(rate)} ${pluralizeUnit(unit || "item", rate)}/s`;
}

function stringifyPostfix(postfix: Record<string, unknown>): string {
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

function safeMessage(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Error) {
    return value.message || value.name;
  }
  return String(value);
}

function assertFiniteNumber(value: unknown, name: string): number {
  if (!isFiniteNumber(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return value;
}

function normalizeNonNegativeNumber(value: number, name: string): number {
  if (value < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0.`);
  }
  return value;
}

function normalizeOptionalNonNegativeNumber(value: unknown, name: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  return normalizeNonNegativeNumber(assertFiniteNumber(value, name), name);
}

function normalizeMode(mode: unknown): FlowbarMode {
  if (mode == null || mode === "") {
    return "auto";
  }
  if (mode === "auto" || mode === "determinate" || mode === "counting" || mode === "indeterminate") {
    return mode;
  }
  throw new TypeError(`mode must be one of "auto", "determinate", "counting", or "indeterminate".`);
}

function normalizeAnimation(animation: unknown): FlowbarAnimation {
  if (animation == null || animation === "") {
    return "spinner";
  }
  if (animation === "spinner" || animation === "marquee" || animation === "bounce" || animation === "pulse") {
    return animation;
  }
  throw new TypeError(`animation must be one of "spinner", "marquee", "bounce", or "pulse".`);
}

function normalizePreset(preset: unknown): FlowbarPreset {
  if (preset == null || preset === "") {
    return "tqdm";
  }
  if (preset === "tqdm" || preset === "compact" || preset === "verbose" || preset === "minimal") {
    return preset;
  }
  throw new TypeError(`preset must be one of "tqdm", "compact", "verbose", or "minimal".`);
}

function normalizeConcurrency(value: unknown): number {
  if (value == null) {
    return 1;
  }
  const concurrency = Math.floor(assertFiniteNumber(value, "concurrency"));
  if (concurrency < 1) {
    throw new RangeError("concurrency must be greater than or equal to 1.");
  }
  return concurrency;
}

function normalizeOptions(options: FlowbarOptions = {}): RequiredNormalizedFlowbarOptions {
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

function getTerminalWidth(output: WritableLike, options: RequiredNormalizedFlowbarOptions): number {
  if (isFiniteNumber(options.width) && options.width > 0) {
    return Math.floor(options.width);
  }
  if (options.dynamicWidth !== false && isFiniteNumber(output?.columns)) {
    return Math.max(1, Math.floor(output.columns - options.wrapGuardColumns));
  }
  return Math.max(1, DEFAULT_TERMINAL_WIDTH - options.wrapGuardColumns);
}

function makeBar(width: number, ratio: number, charset: Exclude<FlowbarCharset, "auto">): string {
  const safeWidth = Math.max(0, Math.floor(width));
  const safeRatio = clampNumber(Number.isFinite(ratio) ? ratio : 0, 0, 1);
  const filledCount = Math.round(safeWidth * safeRatio);
  const full = charset === "ascii" ? "#" : "█";
  const empty = charset === "ascii" ? "-" : "░";
  return `${full.repeat(filledCount)}${empty.repeat(Math.max(0, safeWidth - filledCount))}`;
}

function makeIndeterminateBar(
  width: number,
  frameIndex: number,
  style: FlowbarAnimation,
  segmentWidth: number | undefined,
  charset: Exclude<FlowbarCharset, "auto">,
): string {
  const safeWidth = Math.max(1, Math.floor(width));
  const full = charset === "ascii" ? "#" : "█";
  const empty = charset === "ascii" ? "-" : "░";
  const segment = clampNumber(Math.floor(segmentWidth || Math.max(3, safeWidth * 0.28)), 1, safeWidth);
  const chars: string[] = Array.from({ length: safeWidth }, () => empty);

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

function compactLine(line: string, width: number): string {
  return truncateDisplay(line.replace(/\s+/g, " ").trim(), width);
}

function padDisplayLeft(value: string, width: number): string {
  const padding = Math.max(0, width - displayWidth(value));
  return `${" ".repeat(padding)}${value}`;
}

function clampDisplay(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }
  return truncateDisplay(value, width);
}

function colorize(value: string, code: number, options: Readonly<RequiredNormalizedFlowbarOptions>): string {
  if (!options.color) {
    return value;
  }
  return `\u001B[${code}m${value}\u001B[0m`;
}

function buildDeterminateLine(snapshot: FlowbarSnapshot, width: number): string {
  const { options } = snapshot;
  const current = Math.max(0, snapshot.current);
  const total = Math.max(0, snapshot.total || 0);
  const ratio = total === 0 ? 1 : clampNumber(current / total, 0, 1);
  const percent = `${padLeft(Math.floor(ratio * 100), 3)}%`;
  const label = options.label ? `${options.label}  ` : "";
  const currentAmount = formatAmount(current, options.unit);
  const totalAmount = formatAmount(total, options.unit);
  const countWidth = Math.max(
    displayWidth(`${currentAmount}/${totalAmount}`),
    displayWidth(`${totalAmount}/${totalAmount}`),
  );
  const count = `${padDisplayLeft(currentAmount, Math.max(0, countWidth - displayWidth(`/${totalAmount}`)))}/${totalAmount}`;
  const elapsed = formatDuration(snapshot.timing.elapsedMs);
  const remaining = snapshot.timing.remainingMs == null ? "--:--" : formatDuration(snapshot.timing.remainingMs);
  const rate = formatRate(snapshot.timing.ratePerSecond || 0, options.unit);
  const postfix = stringifyPostfix(snapshot.postfix);
  const charset = options.charset;

  if (options.preset === "minimal") {
    return compactLine(`${label}${percent} ${count}`, width);
  }

  const tailCandidates: string[] = [];
  if (options.preset === "verbose") {
    tailCandidates.push(` ${count}`);
    tailCandidates.push(` elapsed ${elapsed}`);
    tailCandidates.push(` remaining ${remaining}`);
    tailCandidates.push(` ${rate}`);
  } else if (options.preset === "compact") {
    tailCandidates.push(` ${count}`);
    tailCandidates.push(` ${elapsed}<${remaining}`);
  } else {
    tailCandidates.push(` ${count}`);
    tailCandidates.push(` [${elapsed}<${remaining}, ${rate}]`);
  }
  if (postfix) {
    tailCandidates.push(` ${postfix}`);
  }

  const prefix = `${label}${percent} |`;
  const suffix = "|";
  const availableWidth = width - displayWidth(`${prefix}${suffix}`);
  if (availableWidth >= 6) {
    const preferredBarWidth = options.preset === "compact"
      ? Math.floor(width * 0.42)
      : Math.floor(width * 0.36);
    const barWidth = clampNumber(preferredBarWidth, 6, availableWidth);
    const tailWidth = Math.max(0, availableWidth - barWidth);
    const bar = makeBar(barWidth, ratio, charset);
    const tail = clampDisplay(tailCandidates.join(""), tailWidth);
    return compactLine(`${prefix}${bar}${suffix}${tail}`, width);
  }

  return compactLine(`${label}${percent} ${count}`, width);
}

function buildCountingLine(snapshot: FlowbarSnapshot, width: number): string {
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

function buildIndeterminateLine(snapshot: FlowbarSnapshot, width: number): string {
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

function buildFinalLine(snapshot: FlowbarSnapshot, state: RendererFinishState, message: string, width: number): string {
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

function buildLine(snapshot: FlowbarSnapshot, width: number): string {
  const safeWidth = Math.max(1, Math.floor(width));
  if (snapshot.mode === "determinate") {
    return buildDeterminateLine(snapshot, safeWidth);
  }
  if (snapshot.mode === "counting") {
    return buildCountingLine(snapshot, safeWidth);
  }
  return buildIndeterminateLine(snapshot, safeWidth);
}

class SilentRenderer implements Renderer {
  register(): void {}
  update(): void {}
  finalize(): void {}
  log(): void {}
  dispose(): void {}
}

class MemoryRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
  }
  register(bar: ProgressBar): void {
    this.update(bar, true);
  }
  update(bar: ProgressBar, _force = false): void {
    const snapshot = bar.snapshot();
    const width = getTerminalWidth(this.options.output, this.options);
    const line = buildLine(snapshot, width);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const width = getTerminalWidth(this.options.output, this.options);
    this.options.onRender?.(buildFinalLine(snapshot, state, message, width), snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.options.onRender?.(`${level}: ${message}`, undefined);
  }
  dispose(): void {}
}

class PlainRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;
  private lastWriteAt: number;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
    this.lastWriteAt = 0;
  }
  register(bar: ProgressBar): void {
    this.update(bar, true);
  }
  update(bar: ProgressBar, force = false): void {
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
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const line = buildFinalLine(snapshot, state, message, getTerminalWidth(this.options.output, this.options));
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.options.output.write(`${level}: ${message}\n`);
    this.options.onRender?.(`${level}: ${message}`, undefined);
  }
  dispose(): void {}
}

class JsonRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
  }
  register(bar: ProgressBar): void {
    this.update(bar, true);
  }
  update(bar: ProgressBar, _force = false): void {
    const snapshot = bar.snapshot();
    const line = JSON.stringify({ type: "progress", snapshot });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const line = JSON.stringify({ type: "final", state, message, snapshot });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    const line = JSON.stringify({ type: "log", level, message });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, undefined);
  }
  dispose(): void {}
}

const terminalHubs = new WeakMap<WritableLike, TerminalHub>();

class TerminalHub {
  readonly output: WritableLike;
  private readonly options: RequiredNormalizedFlowbarOptions;
  private readonly entries = new Map<number, ProgressBar>();
  private renderedLineCount = 0;
  private disposed = false;
  private refCount = 0;
  private lastRenderAt = 0;
  private readonly resizeHandler: () => void;

  constructor(output: WritableLike, options: RequiredNormalizedFlowbarOptions) {
    this.output = output;
    this.options = options;
    this.resizeHandler = () => {
      this.render(true);
    };
    if (typeof output.on === "function") {
      output.on("resize", this.resizeHandler);
    }
  }
  acquire(): void {
    this.refCount += 1;
  }
  release(): boolean {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.dispose();
      return true;
    }
    return false;
  }
  register(bar: ProgressBar): void {
    this.entries.set(bar.id, bar);
    this.render(true);
  }
  update(bar: ProgressBar, force = false): void {
    this.render(force, bar.options.interval);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    this.entries.delete(bar.id);
    const width = getTerminalWidth(this.output, bar.options);
    const line = buildFinalLine(bar.snapshot(), state, message, width);
    if (leave) {
      this.safeWriteLine(line, bar.options);
    } else {
      this.render(true);
    }
  }
  log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.safeWriteLine(`${level}: ${message}`, bar.options);
  }
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (typeof this.output.off === "function") {
      this.output.off("resize", this.resizeHandler);
    }
  }
  moveToLiveTop(): void {
    if (this.renderedLineCount <= 0) {
      return;
    }
    let frame = "\r";
    if (this.renderedLineCount > 1) {
      frame += `\u001B[${this.renderedLineCount - 1}A`;
    }
    this.output.write(frame);
  }
  deleteLiveRegion(): void {
    if (this.renderedLineCount <= 0) {
      return;
    }
    let frame = "\r";
    if (this.renderedLineCount > 1) {
      frame += `\u001B[${this.renderedLineCount - 1}A`;
    }
    frame += `\u001B[${this.renderedLineCount}M`;
    this.output.write(frame);
    this.renderedLineCount = 0;
  }
  safeWriteLine(line: string, options: RequiredNormalizedFlowbarOptions): void {
    this.deleteLiveRegion();
    this.output.write(`${truncateDisplay(line, getTerminalWidth(this.output, options))}\n`);
    this.render(true);
  }
  render(force: boolean, interval = this.options.interval): void {
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
    let frame = "";
    if (this.renderedLineCount > 0) {
      frame += "\r";
      if (this.renderedLineCount > 1) {
        frame += `\u001B[${this.renderedLineCount - 1}A`;
      }
    }
    const maximumLines = Math.max(this.renderedLineCount, lines.length);
    for (let index = 0; index < maximumLines; index += 1) {
      if (index < lines.length) {
        frame += `\r${lines[index]}\u001B[0K`;
      } else {
        frame += "\r\u001B[2K";
      }
      if (index < maximumLines - 1) {
        frame += "\n";
      }
    }
    if (lines.length < maximumLines) {
      frame += `\u001B[${maximumLines - lines.length}A`;
    }
    this.output.write(frame);
    this.renderedLineCount = lines.length;
  }
}

class TerminalRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;
  private readonly hub: TerminalHub;
  private disposed = false;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
    let hub = terminalHubs.get(options.output);
    if (!hub) {
      hub = new TerminalHub(options.output, options);
      terminalHubs.set(options.output, hub);
    }
    hub.acquire();
    this.hub = hub;
  }
  register(bar: ProgressBar): void {
    this.hub.register(bar);
  }
  update(bar: ProgressBar, force = false): void {
    this.hub.update(bar, force);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    this.hub.finalize(bar, state, message, leave);
  }
  log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.hub.log(bar, level, message);
  }
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.hub.release()) {
      terminalHubs.delete(this.options.output);
    }
  }
}

function isCiEnvironment(): boolean {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.GITLAB_CI === "true" || process.env.BITBUCKET_BUILD_NUMBER != null;
}

function createRenderer(options: RequiredNormalizedFlowbarOptions): Renderer {
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
  readonly id: number;
  private readonly normalizedOptions: RequiredNormalizedFlowbarOptions;
  private currentValue: number;
  private totalValue: number | undefined;
  private statusValue: string;
  private postfixValue: Record<string, unknown>;
  private startedAtValue: number;
  private updatedAtValue: number;
  private lastRateAt: number;
  private lastRateValue: number;
  private ratePerSecond: number | null;
  private frameIndexValue: number;
  private closedValue: boolean;
  private readonly renderer: Renderer;
  private abortHandler: (() => void) | undefined;
  private animationTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: FlowbarOptions = {}) {
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
    this.syncAnimationTimer();
  }

  get options(): Readonly<RequiredNormalizedFlowbarOptions> {
    const spinnerFrames = this.normalizedOptions.spinnerFrames
      ? this.normalizedOptions.spinnerFrames.slice()
      : undefined;
    return { ...this.normalizedOptions, spinnerFrames };
  }

  get current(): number {
    return this.currentValue;
  }

  get total(): number | undefined {
    return this.totalValue;
  }

  get status(): string {
    return this.statusValue;
  }

  get postfix(): Record<string, unknown> {
    return { ...this.postfixValue };
  }

  get startedAt(): number {
    return this.startedAtValue;
  }

  get updatedAt(): number {
    return this.updatedAtValue;
  }

  get frameIndex(): number {
    return this.frameIndexValue;
  }

  get closed(): boolean {
    return this.closedValue;
  }

  getMode(): Exclude<FlowbarMode, "auto"> {
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

  snapshot(): FlowbarSnapshot {
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

  private updateRate(previousValue: number, nextValue: number): void {
    const currentTime = now();
    const elapsedSeconds = (currentTime - this.lastRateAt) / 1000;
    const delta = nextValue - previousValue;
    if (elapsedSeconds > 0 && delta !== 0) {
      const instantRate = delta / elapsedSeconds;
      if (instantRate > 0) {
        if (this.ratePerSecond == null) {
          this.ratePerSecond = instantRate;
        } else {
          const smoothing = this.normalizedOptions.rateSmoothing;
          this.ratePerSecond = this.ratePerSecond * smoothing + instantRate * (1 - smoothing);
        }
      }
    }
    this.lastRateAt = currentTime;
    this.lastRateValue = nextValue;
    this.updatedAtValue = currentTime;
  }

  private render(force = false): void {
    if (this.closedValue) {
      return;
    }
    this.renderer.update(this, force);
  }

  private shouldAnimate(): boolean {
    return this.normalizedOptions.enabled && this.normalizedOptions.renderer !== "silent" && this.getMode() === "indeterminate";
  }

  private startAnimationTimer(): void {
    if (this.animationTimer || !this.shouldAnimate()) {
      return;
    }
    const interval = this.normalizedOptions.indeterminateInterval || this.normalizedOptions.interval;
    this.animationTimer = setInterval(() => {
      if (this.closedValue || !this.shouldAnimate()) {
        this.stopAnimationTimer();
        return;
      }
      this.frameIndexValue += 1;
      this.updatedAtValue = now();
      this.renderer.update(this, true);
    }, interval);
    if (typeof this.animationTimer.unref === "function") {
      this.animationTimer.unref();
    }
  }

  private stopAnimationTimer(): void {
    if (!this.animationTimer) {
      return;
    }
    clearInterval(this.animationTimer);
    this.animationTimer = undefined;
  }

  private syncAnimationTimer(): void {
    if (this.shouldAnimate()) {
      this.startAnimationTimer();
    } else {
      this.stopAnimationTimer();
    }
  }

  increment(delta = 1): this {
    if (this.closedValue) {
      return this;
    }
    const numericDelta = assertFiniteNumber(delta, "delta");
    const previous = this.currentValue;
    this.currentValue = Math.max(0, this.currentValue + numericDelta);
    this.updateRate(previous, this.currentValue);
    this.syncAnimationTimer();
    this.render(false);
    return this;
  }

  update(value: number): this {
    if (this.closedValue) {
      return this;
    }
    const previous = this.currentValue;
    this.currentValue = Math.max(0, assertFiniteNumber(value, "value"));
    this.updateRate(previous, this.currentValue);
    this.syncAnimationTimer();
    this.render(false);
    return this;
  }

  setTotal(total: number | null | undefined): this {
    if (this.closedValue) {
      return this;
    }
    this.totalValue = normalizeOptionalNonNegativeNumber(total, "total");
    if (this.totalValue != null) {
      this.normalizedOptions.mode = "determinate";
    }
    this.updatedAtValue = now();
    this.syncAnimationTimer();
    this.render(true);
    return this;
  }

  setMode(mode: FlowbarMode): this {
    if (this.closedValue) {
      return this;
    }
    this.normalizedOptions.mode = normalizeMode(mode);
    this.updatedAtValue = now();
    this.syncAnimationTimer();
    this.render(true);
    return this;
  }

  setStatus(status: string): this {
    if (this.closedValue) {
      return this;
    }
    this.statusValue = String(status);
    this.updatedAtValue = now();
    this.render(true);
    return this;
  }

  setPostfix(postfix: Record<string, unknown>): this {
    if (this.closedValue) {
      return this;
    }
    this.postfixValue = { ...(postfix || {}) };
    this.updatedAtValue = now();
    this.render(true);
    return this;
  }

  log(message: unknown): this {
    this.renderer.log(this, "info", safeMessage(message));
    return this;
  }

  warn(message: unknown): this {
    this.renderer.log(this, "warn", safeMessage(message));
    return this;
  }

  error(message: unknown): this {
    this.renderer.log(this, "error", safeMessage(message));
    return this;
  }

  close(message?: unknown, options: FlowbarCloseOptions = {}): this {
    return this.finish("closed", message, options.leave);
  }

  succeed(message: unknown = "done"): this {
    return this.finish("success", message);
  }

  fail(errorOrMessage?: unknown): this {
    return this.finish("failure", safeMessage(errorOrMessage));
  }

  cancel(message: unknown = "cancelled"): this {
    return this.finish("cancelled", message);
  }

  private finish(state: RendererFinishState, message?: unknown, leave?: boolean): this {
    if (this.closedValue) {
      return this;
    }
    this.closedValue = true;
    this.updatedAtValue = now();
    this.stopAnimationTimer();
    if (this.normalizedOptions.signal && this.abortHandler) {
      this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
      this.abortHandler = undefined;
    }
    this.renderer.finalize(this, state, safeMessage(message), leave ?? this.normalizedOptions.leave);
    this.renderer.dispose?.();
    return this;
  }
}

function createProgressBar(options: FlowbarOptions = {}): ProgressBar {
  return new ProgressBar(options);
}

function wrapSyncIterable<T>(input: Iterable<T>, options: FlowbarOptions = {}): Iterable<T> {
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
    } catch (error) {
      if (isAbortErrorLike(error)) {
        bar.cancel("aborted");
      } else {
        bar.fail(error);
      }
      throw error;
    } finally {
      if (!completedNormally && !bar.closed) {
        bar.close();
      }
    }
  }
  return generator();
}

function wrapAsyncIterable<T>(input: AsyncIterable<T>, options: FlowbarOptions = {}): AsyncIterable<T> {
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
    } catch (error) {
      if (isAbortErrorLike(error)) {
        bar.cancel("aborted");
      } else {
        bar.fail(error);
      }
      throw error;
    } finally {
      if (!completedNormally && !bar.closed) {
        bar.close();
      }
    }
  }
  return generator();
}

function flowbar<T>(input: Iterable<T> | AsyncIterable<T>, options: FlowbarOptions = {}): Iterable<T> | AsyncIterable<T> {
  if (isAsyncIterable(input)) {
    return wrapAsyncIterable(input, options);
  }
  if (isIterable(input)) {
    return wrapSyncIterable(input, options);
  }
  throw new TypeError("flowbar(input) expects an Iterable or AsyncIterable input.");
}

function toAsyncIterator<T>(input: Iterable<T> | AsyncIterable<T>): AsyncIteratorLike<T> {
  if (isAsyncIterable(input)) {
    return input[Symbol.asyncIterator]();
  }
  if (isIterable(input)) {
    const iterator = input[Symbol.iterator]();
    return {
      async next() {
        return iterator.next();
      },
      async return(value?: unknown) {
        if (typeof iterator.return === "function") {
          return iterator.return(value);
        }
        return { done: true, value: value as T };
      },
    };
  }
  throw new TypeError("Expected an Iterable or AsyncIterable input.");
}

async function closeIterator<T>(iterator: AsyncIteratorLike<T>): Promise<void> {
  if (typeof iterator.return === "function") {
    await iterator.return();
  }
}

async function runWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarMapper<T, R>,
  options: FlowbarMapOptions,
  collectResults: true,
): Promise<R[]>;
async function runWithProgress<T>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarHandler<T>,
  options: FlowbarMapOptions,
  collectResults: false,
): Promise<void>;
async function runWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarMapper<T, R> | FlowbarHandler<T>,
  options: FlowbarMapOptions,
  collectResults: boolean,
): Promise<R[] | void> {
  const total = options.total ?? inferTotal(input);
  const concurrency = normalizeConcurrency(options.concurrency);
  const bar = createProgressBar({ ...options, total });
  const iterator = toAsyncIterator(input);
  const results: R[] = [];
  let nextIndex = 0;
  let iteratorLock: Promise<unknown> = Promise.resolve();
  let stopped = false;

  async function nextItem(): Promise<WorkItem<T>> {
    const run: Promise<WorkItem<T>> = iteratorLock.then(async (): Promise<WorkItem<T>> => {
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

  async function worker(): Promise<void> {
    for (;;) {
      const item = await nextItem();
      if (item.done) {
        return;
      }
      const mapped = await handler(item.value, item.index, bar);
      if (collectResults) {
        results[item.index] = mapped as R;
      }
      bar.increment(1);
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    bar.succeed();
    return collectResults ? results : undefined;
  } catch (error) {
    stopped = true;
    await closeIterator(iterator);
    if (isAbortErrorLike(error)) {
      bar.cancel("aborted");
    } else {
      bar.fail(error);
    }
    throw error;
  }
}

async function mapWithProgress<T, R>(input: Iterable<T> | AsyncIterable<T>, mapper: FlowbarMapper<T, R>, options: FlowbarMapOptions = {}): Promise<R[]> {
  if (typeof mapper !== "function") {
    throw new TypeError("flowbar.map(input, mapper) expects mapper to be a function.");
  }
  return runWithProgress(input, mapper, options, true);
}

async function eachWithProgress<T>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options: FlowbarMapOptions = {}): Promise<void> {
  if (typeof handler !== "function") {
    throw new TypeError("flowbar.each(input, handler) expects handler to be a function.");
  }
  await runWithProgress(input, handler, options, false);
}

function streamWithProgress(options: FlowbarOptions = {}): Transform & { flowbar: ProgressBar } {
  const bar = createProgressBar({ ...options, unit: options.unit || "byte" });
  const unit = bar.options.unit;
  const transform = new Transform({
    transform(chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null, data?: unknown) => void) {
      try {
        const amount = unit === "byte" && chunk != null && typeof chunk === "object" && "length" in chunk && isFiniteNumber(chunk.length) ? chunk.length : 1;
        bar.increment(amount);
        callback(null, chunk);
      } catch (error) {
        bar.fail(error);
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
    flush(callback: (error?: Error | null) => void) {
      try {
        bar.succeed();
        callback();
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
  }) as Transform & { flowbar: ProgressBar };
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

function createGroup(options: FlowbarOptions = {}): FlowbarGroup {
  const groupOptions = { ...options };
  const bars = new Set<ProgressBar>();
  function track(bar: ProgressBar): ProgressBar {
    bars.add(bar);
    return bar;
  }
  return {
    create(childOptions: FlowbarOptions = {}) {
      const label = childOptions.label || groupOptions.label;
      return track(createProgressBar({ ...groupOptions, ...childOptions, label }));
    },
    wait(childOptions: FlowbarOptions = {}) {
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

async function task<T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options: FlowbarOptions = {}): Promise<T> {
  const root = createProgressBar({ ...options, label, mode: "indeterminate", status: options.status || "running" });
  const taskApi: FlowbarTaskApi = {
    bar: root,
    async step<U>(stepLabel: string, stepHandler: (bar: ProgressBar) => U | Promise<U>): Promise<U> {
      root.setStatus(stepLabel);
      return stepHandler(root);
    },
    async indeterminate<U>(stepLabel: string, stepHandler: (bar: ProgressBar) => U | Promise<U>): Promise<U> {
      root.setMode("indeterminate");
      root.setStatus(stepLabel);
      return stepHandler(root);
    },
    async progress<U>(stepLabel: string, items: Iterable<U> | AsyncIterable<U>, itemHandler: FlowbarHandler<U>, progressOptions: FlowbarMapOptions = {}): Promise<void> {
      root.close(undefined, { leave: false });
      return eachWithProgress(items, itemHandler, { ...options, ...progressOptions, label: stepLabel });
    },
  };
  try {
    const result = await handler(taskApi);
    if (!root.closed) {
      root.succeed();
    }
    return result;
  } catch (error) {
    if (!root.closed) {
      root.fail(error);
    }
    throw error;
  }
}

export function configure(defaultOptions: FlowbarOptions = {}): FlowbarFunction {
  const configured = function configuredFlowbar<T>(input: Iterable<T> | AsyncIterable<T>, options: FlowbarOptions = {}) {
    return flowbar(input, { ...defaultOptions, ...options });
  } as FlowbarFunction;
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

const flowbarApi = flowbar as FlowbarFunction;
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
