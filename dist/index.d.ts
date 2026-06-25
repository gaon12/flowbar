/**
 * flowbar TypeScript source.
 *
 * 패키지는 zero runtime dependency를 유지하기 위해 Node.js core API만 사용합니다.
 */
import { Transform } from "node:stream";
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
    stream(options?: FlowbarOptions): Transform & {
        flowbar: ProgressBar;
    };
    group(options?: FlowbarOptions): FlowbarGroup;
    task<T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options?: FlowbarOptions): Promise<T>;
    configure(defaultOptions?: FlowbarOptions): FlowbarFunction;
    ProgressBar: typeof ProgressBar;
}
export type FlowbarCloseOptions = {
    leave?: boolean;
};
export declare class ProgressBar {
    readonly id: number;
    private readonly normalizedOptions;
    private currentValue;
    private totalValue;
    private statusValue;
    private postfixValue;
    private startedAtValue;
    private updatedAtValue;
    private lastRateAt;
    private lastRateValue;
    private ratePerSecond;
    private frameIndexValue;
    private closedValue;
    private readonly renderer;
    private abortHandler;
    private animationTimer;
    constructor(options?: FlowbarOptions);
    get options(): Readonly<RequiredNormalizedFlowbarOptions>;
    get current(): number;
    get total(): number | undefined;
    get status(): string;
    get postfix(): Record<string, unknown>;
    get startedAt(): number;
    get updatedAt(): number;
    get frameIndex(): number;
    get closed(): boolean;
    getMode(): Exclude<FlowbarMode, "auto">;
    snapshot(): FlowbarSnapshot;
    private updateRate;
    private render;
    private shouldAnimate;
    private startAnimationTimer;
    private stopAnimationTimer;
    private syncAnimationTimer;
    increment(delta?: number): this;
    update(value: number): this;
    setTotal(total: number | null | undefined): this;
    setMode(mode: FlowbarMode): this;
    setStatus(status: string): this;
    setPostfix(postfix: Record<string, unknown>): this;
    log(message: unknown): this;
    warn(message: unknown): this;
    error(message: unknown): this;
    close(message?: unknown, options?: FlowbarCloseOptions): this;
    succeed(message?: unknown): this;
    fail(errorOrMessage?: unknown): this;
    cancel(message?: unknown): this;
    private finish;
}
export declare function configure(defaultOptions?: FlowbarOptions): FlowbarFunction;
declare const flowbarApi: FlowbarFunction;
export default flowbarApi;
