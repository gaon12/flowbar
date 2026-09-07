import type { ProgressBar } from "./progress.js";
import type { Renderer, RendererFinishState, RequiredNormalizedFlowbarOptions, WritableLike } from "./types.js";
export declare const terminalHubs: WeakMap<WritableLike, TerminalHub>;
export declare class TerminalHub {
    readonly output: WritableLike;
    private readonly options;
    private readonly entries;
    private renderedLineCount;
    private disposed;
    private refCount;
    private lastRenderAt;
    private readonly resizeHandler;
    constructor(output: WritableLike, options: RequiredNormalizedFlowbarOptions);
    acquire(): void;
    release(): boolean;
    register(bar: ProgressBar): void;
    update(bar: ProgressBar, force?: boolean): void;
    finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
    log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
    dispose(): void;
    moveToLiveTop(): void;
    deleteLiveRegion(): void;
    safeWriteLine(line: string, options: RequiredNormalizedFlowbarOptions): void;
    render(force: boolean, interval?: number): void;
}
export declare class TerminalRenderer implements Renderer {
    readonly animated = true;
    readonly options: RequiredNormalizedFlowbarOptions;
    private readonly hub;
    private disposed;
    constructor(options: RequiredNormalizedFlowbarOptions);
    register(bar: ProgressBar): void;
    update(bar: ProgressBar, force?: boolean): void;
    finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
    log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
    dispose(): void;
}
