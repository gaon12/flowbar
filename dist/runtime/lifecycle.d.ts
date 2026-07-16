import type { ProgressBar } from "./progress-bar.js";
export declare function allocateProgressBarId(): number;
export declare function onProgressBarClose(bar: ProgressBar, listener: () => void): () => void;
export declare function notifyProgressBarClose(bar: ProgressBar): void;
