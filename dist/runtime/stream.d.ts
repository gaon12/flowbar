import { Transform } from "node:stream";
import type { FlowbarStreamOptions } from "../types.js";
import { type ProgressBar } from "./progress-bar.js";
export declare function streamWithProgress(options?: FlowbarStreamOptions): Transform & {
    flowbar: ProgressBar;
};
