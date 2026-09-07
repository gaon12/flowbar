import type { ProgressBar } from "./progress.js";
import type { Renderer, RendererFinishState, RequiredNormalizedFlowbarOptions } from "./types.js";
export declare class SilentRenderer implements Renderer {
    readonly animated = false;
    register(): void;
    update(): void;
    finalize(): void;
    log(): void;
    dispose(): void;
}
export declare class MemoryRenderer implements Renderer {
    readonly animated = true;
    readonly options: RequiredNormalizedFlowbarOptions;
    constructor(options: RequiredNormalizedFlowbarOptions);
    register(bar: ProgressBar): void;
    update(bar: ProgressBar, _force?: boolean): void;
    finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
    log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
    dispose(): void;
}
export declare class PlainRenderer implements Renderer {
    readonly animated = false;
    readonly options: RequiredNormalizedFlowbarOptions;
    private lastWriteAt;
    constructor(options: RequiredNormalizedFlowbarOptions);
    register(bar: ProgressBar): void;
    update(bar: ProgressBar, force?: boolean): void;
    finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
    log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
    dispose(): void;
}
export declare class JsonRenderer implements Renderer {
    readonly animated = false;
    readonly options: RequiredNormalizedFlowbarOptions;
    private lastWriteAt;
    constructor(options: RequiredNormalizedFlowbarOptions);
    register(bar: ProgressBar): void;
    update(bar: ProgressBar, force?: boolean): void;
    finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void;
    log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void;
    dispose(): void;
}
export declare function isCiEnvironment(): boolean;
export declare function createRenderer(options: RequiredNormalizedFlowbarOptions): Renderer;
