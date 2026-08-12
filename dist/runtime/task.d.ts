import type { FlowbarOptions, FlowbarTaskApi } from "../types.js";
export declare function task<T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options?: FlowbarOptions): Promise<T>;
