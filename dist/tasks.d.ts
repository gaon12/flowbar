import type { FlowbarGroup, FlowbarOptions, FlowbarTaskApi } from "./types.js";
export declare function createGroup(options?: FlowbarOptions): FlowbarGroup;
export declare function task<T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options?: FlowbarOptions): Promise<T>;
