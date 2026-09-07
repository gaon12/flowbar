import type { FlowbarTiming } from "../types.js";
import { now } from "./utils.js";

export class ProgressClock {
  readonly startedAt: number;
  private updatedAtValue: number;
  private lastRateAt: number;
  private ratePerSecond: number | null = null;

  constructor() {
    this.startedAt = now();
    this.updatedAtValue = this.startedAt;
    this.lastRateAt = this.startedAt;
  }

  get updatedAt(): number {
    return this.updatedAtValue;
  }

  touch(): void {
    this.updatedAtValue = now();
  }

  updateRate(previousValue: number, nextValue: number, smoothing: number): void {
    const currentTime = now();
    const elapsedSeconds = (currentTime - this.lastRateAt) / 1000;
    const delta = nextValue - previousValue;
    if (elapsedSeconds > 0 && delta > 0) {
      const instantRate = delta / elapsedSeconds;
      this.ratePerSecond =
        this.ratePerSecond == null ? instantRate : this.ratePerSecond * smoothing + instantRate * (1 - smoothing);
    }
    this.lastRateAt = currentTime;
    this.updatedAtValue = currentTime;
  }

  snapshot(current: number, total: number | undefined, minElapsedMsForEta: number): FlowbarTiming {
    const currentTime = now();
    const elapsedMs = Math.max(0, currentTime - this.startedAt);
    const rate = this.ratePerSecond ?? (elapsedMs > 0 && current > 0 ? current / (elapsedMs / 1000) : null);
    const remainingMs =
      total != null && rate != null && rate > 0 && elapsedMs >= minElapsedMsForEta
        ? Math.max(0, (total - current) / rate) * 1000
        : null;
    return {
      startedAt: this.startedAt,
      updatedAt: this.updatedAtValue,
      elapsedMs,
      remainingMs,
      etaAt: remainingMs == null ? null : Date.now() + remainingMs,
      ratePerSecond: rate,
    };
  }
}
