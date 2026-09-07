import type { FlowbarSnapshot } from "./types.js";
/** Serialize data only: never traverse streams, signals, callbacks or arbitrary options. */
export declare function jsonSnapshot(snapshot: FlowbarSnapshot): unknown;
