import { Transform } from "node:stream";
import { type ProgressBar } from "./progress.js";
import type { FlowbarOptions } from "./types.js";
export declare function streamWithProgress(options?: FlowbarOptions): Transform & {
    flowbar: ProgressBar;
};
