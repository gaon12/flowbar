import type { FlowbarFunction, FlowbarOptions } from "./types.js";
export declare function configure(defaultOptions?: FlowbarOptions): FlowbarFunction;
declare const flowbarApi: FlowbarFunction;
export default flowbarApi;
export { ProgressBar } from "./progress.js";
export type { FlowbarAnimation, FlowbarCharset, FlowbarCloseCallback, FlowbarFinishState, FlowbarFunction, FlowbarGroup, FlowbarHandler, FlowbarMapOptions, FlowbarMapper, FlowbarMode, FlowbarOptions, FlowbarPreset, FlowbarRenderCallback, FlowbarRendererName, FlowbarSnapshot, FlowbarTaskApi, FlowbarTiming, FlowbarUnit, RequiredNormalizedFlowbarOptions, WritableLike, } from "./types.js";
