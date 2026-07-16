import type { FlowbarAnimation, FlowbarMode, FlowbarOptions, FlowbarPreset, RequiredNormalizedFlowbarOptions, WritableLike } from "../types.js";
export declare const MAX_CONCURRENCY = 1024;
export declare function normalizeMode(mode: unknown): FlowbarMode;
export declare function normalizeAnimation(animation: unknown): FlowbarAnimation;
export declare function normalizePreset(preset: unknown): FlowbarPreset;
export declare function normalizeConcurrency(value: unknown): number;
export declare function normalizeOptions(options?: FlowbarOptions): RequiredNormalizedFlowbarOptions;
export declare function getTerminalWidth(output: WritableLike, options: RequiredNormalizedFlowbarOptions): number;
