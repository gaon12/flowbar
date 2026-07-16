import { normalizeMode, normalizeOptions } from "../core/options.js";
import { cloneData, readonlySnapshot } from "../core/snapshot.js";
import { assertFiniteNumber, normalizeOptionalNonNegativeNumber, now, safeMessage } from "../core/utils.js";
import { createRenderer } from "../rendering/renderers.js";
import type {
  FlowbarCloseOptions,
  FlowbarMode,
  FlowbarOptions,
  FlowbarOptionsSnapshot,
  FlowbarSnapshot,
  Renderer,
  RendererFinishState,
  RequiredNormalizedFlowbarOptions,
} from "../types.js";

let nextProgressBarId = 1;
function allocateProgressBarId(): number {
  const id = nextProgressBarId;
  nextProgressBarId += 1;
  return id;
}

export class ProgressBar {
  readonly id: number;
  private readonly normalizedOptions: RequiredNormalizedFlowbarOptions;
  private currentValue: number;
  private totalValue: number | undefined;
  private statusValue: string;
  private postfixValue: Record<string, unknown>;
  private startedAtValue: number;
  private updatedAtValue: number;
  private lastRateAt: number;
  private ratePerSecond: number | null;
  private frameIndexValue: number;
  private closedValue: boolean;
  private readonly renderer: Renderer;
  private abortHandler: (() => void) | undefined;
  private animationTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: FlowbarOptions = {}) {
    this.id = allocateProgressBarId();
    this.normalizedOptions = normalizeOptions(options);
    this.currentValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.current, "current") ?? 0;
    this.totalValue = normalizeOptionalNonNegativeNumber(this.normalizedOptions.total, "total");
    this.statusValue = this.normalizedOptions.status;
    this.postfixValue = cloneData(this.normalizedOptions.postfix || {});
    this.startedAtValue = now();
    this.updatedAtValue = this.startedAtValue;
    this.lastRateAt = this.startedAtValue;
    this.ratePerSecond = null;
    this.frameIndexValue = 0;
    this.closedValue = false;
    this.renderer = createRenderer(this.normalizedOptions);
    this.abortHandler = undefined;
    this.animationTimer = undefined;

    if (this.normalizedOptions.signal) {
      this.abortHandler = () => {
        this.cancel("aborted");
      };
      if (this.normalizedOptions.signal.aborted) {
        this.cancel("aborted");
        return;
      }
      this.normalizedOptions.signal.addEventListener("abort", this.abortHandler, { once: true });
    }

    this.renderer.register(this);
    this.syncAnimationTimer();
  }

  get options(): FlowbarOptionsSnapshot {
    const snapshot = { ...this.normalizedOptions } as Partial<RequiredNormalizedFlowbarOptions>;
    delete snapshot.output;
    delete snapshot.signal;
    delete snapshot.onRender;
    return readonlySnapshot(snapshot) as FlowbarOptionsSnapshot;
  }

  get current(): number {
    return this.currentValue;
  }

  get total(): number | undefined {
    return this.totalValue;
  }

  get status(): string {
    return this.statusValue;
  }

  get postfix(): Readonly<Record<string, unknown>> {
    return readonlySnapshot(this.postfixValue);
  }

  get startedAt(): number {
    return this.startedAtValue;
  }

  get updatedAt(): number {
    return this.updatedAtValue;
  }

  get frameIndex(): number {
    return this.frameIndexValue;
  }

  get closed(): boolean {
    return this.closedValue;
  }

  getMode(): Exclude<FlowbarMode, "auto"> {
    if (this.normalizedOptions.mode && this.normalizedOptions.mode !== "auto") {
      return this.normalizedOptions.mode;
    }
    if (this.totalValue != null) {
      return "determinate";
    }
    if (this.currentValue > 0) {
      return "counting";
    }
    return "indeterminate";
  }

  snapshot(): FlowbarSnapshot {
    const currentTime = now();
    const elapsedMs = Math.max(0, currentTime - this.startedAtValue);
    const rate =
      this.ratePerSecond ?? (elapsedMs > 0 && this.currentValue > 0 ? this.currentValue / (elapsedMs / 1000) : null);
    const remainingMs =
      this.totalValue != null && rate != null && rate > 0 && elapsedMs >= this.normalizedOptions.minElapsedMsForEta
        ? Math.max(0, (this.totalValue - this.currentValue) / rate) * 1000
        : null;
    return {
      id: this.id,
      current: this.currentValue,
      total: this.totalValue,
      mode: this.getMode(),
      status: this.statusValue,
      postfix: readonlySnapshot(this.postfixValue),
      frameIndex: this.frameIndexValue,
      options: this.options,
      timing: {
        startedAt: this.startedAtValue,
        updatedAt: this.updatedAtValue,
        elapsedMs,
        remainingMs,
        etaAt: remainingMs == null ? null : Date.now() + remainingMs,
        ratePerSecond: rate,
      },
    };
  }

  private updateRate(previousValue: number, nextValue: number): void {
    const currentTime = now();
    const elapsedSeconds = (currentTime - this.lastRateAt) / 1000;
    const delta = nextValue - previousValue;
    if (elapsedSeconds > 0 && delta !== 0) {
      const instantRate = delta / elapsedSeconds;
      if (instantRate > 0) {
        if (this.ratePerSecond == null) {
          this.ratePerSecond = instantRate;
        } else {
          const smoothing = this.normalizedOptions.rateSmoothing;
          this.ratePerSecond = this.ratePerSecond * smoothing + instantRate * (1 - smoothing);
        }
      }
    }
    this.lastRateAt = currentTime;
    this.updatedAtValue = currentTime;
  }

  private render(force = false): void {
    if (this.closedValue) {
      return;
    }
    this.renderer.update(this, force);
  }

  private shouldAnimate(): boolean {
    return (
      this.normalizedOptions.enabled &&
      this.normalizedOptions.renderer !== "silent" &&
      this.getMode() === "indeterminate"
    );
  }

  private startAnimationTimer(): void {
    if (this.animationTimer || !this.shouldAnimate()) {
      return;
    }
    const interval = this.normalizedOptions.indeterminateInterval || this.normalizedOptions.interval;
    this.animationTimer = setInterval(() => {
      if (this.closedValue || !this.shouldAnimate()) {
        this.stopAnimationTimer();
        return;
      }
      this.frameIndexValue += 1;
      this.updatedAtValue = now();
      this.renderer.update(this, true);
    }, interval);
    if (typeof this.animationTimer.unref === "function") {
      this.animationTimer.unref();
    }
  }

  private stopAnimationTimer(): void {
    if (!this.animationTimer) {
      return;
    }
    clearInterval(this.animationTimer);
    this.animationTimer = undefined;
  }

  private syncAnimationTimer(): void {
    if (this.shouldAnimate()) {
      this.startAnimationTimer();
    } else {
      this.stopAnimationTimer();
    }
  }

  increment(delta = 1): this {
    if (this.closedValue) {
      return this;
    }
    const numericDelta = assertFiniteNumber(delta, "delta");
    const previous = this.currentValue;
    this.currentValue = Math.max(0, this.currentValue + numericDelta);
    this.updateRate(previous, this.currentValue);
    this.syncAnimationTimer();
    this.render(false);
    return this;
  }

  update(value: number): this {
    if (this.closedValue) {
      return this;
    }
    const previous = this.currentValue;
    this.currentValue = Math.max(0, assertFiniteNumber(value, "value"));
    this.updateRate(previous, this.currentValue);
    this.syncAnimationTimer();
    this.render(false);
    return this;
  }

  setTotal(total: number | null | undefined): this {
    if (this.closedValue) {
      return this;
    }
    this.totalValue = normalizeOptionalNonNegativeNumber(total, "total");
    if (this.totalValue != null) {
      this.normalizedOptions.mode = "determinate";
    }
    this.updatedAtValue = now();
    this.syncAnimationTimer();
    this.render(true);
    return this;
  }

  setMode(mode: FlowbarMode): this {
    if (this.closedValue) {
      return this;
    }
    this.normalizedOptions.mode = normalizeMode(mode);
    this.updatedAtValue = now();
    this.syncAnimationTimer();
    this.render(true);
    return this;
  }

  setStatus(status: string): this {
    if (this.closedValue) {
      return this;
    }
    this.statusValue = String(status);
    this.updatedAtValue = now();
    this.render(true);
    return this;
  }

  setPostfix(postfix: Record<string, unknown>): this {
    if (this.closedValue) {
      return this;
    }
    this.postfixValue = cloneData(postfix || {});
    this.updatedAtValue = now();
    this.render(true);
    return this;
  }

  log(message: unknown): this {
    this.renderer.log(this, "info", safeMessage(message));
    return this;
  }

  warn(message: unknown): this {
    this.renderer.log(this, "warn", safeMessage(message));
    return this;
  }

  error(message: unknown): this {
    this.renderer.log(this, "error", safeMessage(message));
    return this;
  }

  close(message?: unknown, options: FlowbarCloseOptions = {}): this {
    return this.finish("closed", message, options.leave);
  }

  succeed(message: unknown = "done"): this {
    return this.finish("success", message);
  }

  fail(errorOrMessage?: unknown): this {
    return this.finish("failure", safeMessage(errorOrMessage));
  }

  cancel(message: unknown = "cancelled"): this {
    return this.finish("cancelled", message);
  }

  private finish(state: RendererFinishState, message?: unknown, leave?: boolean): this {
    if (this.closedValue) {
      return this;
    }
    this.closedValue = true;
    this.updatedAtValue = now();
    this.stopAnimationTimer();
    if (this.normalizedOptions.signal && this.abortHandler) {
      this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
      this.abortHandler = undefined;
    }
    this.renderer.finalize(this, state, safeMessage(message), leave ?? this.normalizedOptions.leave);
    this.renderer.dispose?.();
    return this;
  }
}

export function createProgressBar(options: FlowbarOptions = {}): ProgressBar {
  return new ProgressBar(options);
}
