import { Transform } from "node:stream";
import type { FlowbarGroup, FlowbarOptions, FlowbarTaskApi } from "../types.js";
import { type ProgressBar } from "./progress-bar.js";
export declare function streamWithProgress(options?: FlowbarOptions): Transform & {
    flowbar: ProgressBar;
};
export declare function createGroup(options?: FlowbarOptions): FlowbarGroup;
export declare function task<T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options?: FlowbarOptions): Promise<T>;
