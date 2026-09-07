import type { Transform } from "node:stream";
import type { ProgressBar } from "./progress.js";

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

export type FlowbarStreamOptions = FlowbarOptions & {
  /** Leave completion to the caller when track() is not used. */
  completion?: "manual";
};

export type FlowbarStream = Transform & {
  flowbar: ProgressBar;
  /** Call immediately with the entire pipeline promise to track destination completion. */
  track<T>(operation: PromiseLike<T>): Promise<T>;
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
  progress<T>(
    label: string,
    items: Iterable<T> | AsyncIterable<T>,
    handler: FlowbarHandler<T>,
    options?: FlowbarMapOptions,
  ): Promise<void>;
};

export interface FlowbarFunction {
  <T>(input: Iterable<T>, options?: FlowbarOptions): Iterable<T>;
  <T>(input: AsyncIterable<T>, options?: FlowbarOptions): AsyncIterable<T>;
  create(options?: FlowbarOptions): ProgressBar;
  wait(options?: FlowbarOptions): ProgressBar;
  indeterminate(options?: FlowbarOptions): ProgressBar;
  spinner(options?: FlowbarOptions): ProgressBar;
  map<T, R>(
    input: Iterable<T> | AsyncIterable<T>,
    mapper: FlowbarMapper<T, R>,
    options?: FlowbarMapOptions,
  ): Promise<R[]>;
  each<T>(
    input: Iterable<T> | AsyncIterable<T>,
    handler: FlowbarHandler<T>,
    options?: FlowbarMapOptions,
  ): Promise<void>;
  stream(options?: FlowbarStreamOptions): FlowbarStream;
  group(options?: FlowbarOptions): FlowbarGroup;
  task<T>(
    label: string,
    handler: (task: FlowbarTaskApi) => T | Promise<T>,
    options?: FlowbarOptions,
  ): Promise<T>;
  configure(defaultOptions?: FlowbarOptions): FlowbarFunction;
  ProgressBar: typeof ProgressBar;
}

export type FlowbarFinishState = "success" | "failure" | "cancelled" | "closed";

export type RendererFinishState = FlowbarFinishState;

export type FlowbarCloseCallback = (
  bar: ProgressBar,
  state: FlowbarFinishState,
  message: string,
) => void;

export type Renderer = {
  readonly animated: boolean;
  register(bar: ProgressBar): void;
  update(bar: ProgressBar, force?: boolean): void;
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
  log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
  dispose(): void;
};

export type AsyncIteratorLike<T> = AsyncIterator<T> & {
  return?(value?: unknown): Promise<IteratorResult<T>> | IteratorResult<T>;
};
