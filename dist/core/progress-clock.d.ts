import type { FlowbarTiming } from "../types.js";
export declare class ProgressClock {
    readonly startedAt: number;
    private updatedAtValue;
    private lastRateAt;
    private ratePerSecond;
    constructor();
    get updatedAt(): number;
    touch(): void;
    updateRate(previousValue: number, nextValue: number, smoothing: number): void;
    snapshot(current: number, total: number | undefined, minElapsedMsForEta: number): FlowbarTiming;
}
