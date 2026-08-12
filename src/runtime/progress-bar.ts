import { normalizeMode, normalizeOptions } from "../core/options.js";
import { ProgressClock } from "../core/progress-clock.js";
import { cloneData, readonlySnapshot } from "../core/snapshot.js";
import { assertFiniteNumber, normalizeOptionalNonNegativeNumber, safeMessage } from "../core/utils.js";
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
import { allocateProgressBarId, notifyProgressBarClose } from "./lifecycle.js";

export class ProgressBar {
  readonly id: number;
  private readonly normalizedOptions: RequiredNormalizedFlowbarOptions;
  private currentValue: number;
  private totalValue: number | undefined;
  private statusValue: string;
  private postfixValue: Record<string, unknown>;
  private modeValue: FlowbarMode;
  private readonly clock: ProgressClock;
  private readonly optionsSnapshot: FlowbarOptionsSnapshot;
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
    this.modeValue = this.normalizedOptions.mode;
    this.clock = new ProgressClock();
    const optionsSnapshot = { ...this.normalizedOptions } as Partial<RequiredNormalizedFlowbarOptions>;
    delete optionsSnapshot.output;
    delete optionsSnapshot.signal;
    delete optionsSnapshot.onRender;
    this.optionsSnapshot = readonlySnapshot(optionsSnapshot) as FlowbarOptionsSnapshot;
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
    if (this.optionsSnapshot.mode === this.modeValue) {
      return this.optionsSnapshot;
    }
    return Object.freeze({ ...this.optionsSnapshot, mode: this.modeValue });
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
    return this.clock.startedAt;
  }

  get updatedAt(): number {
    return this.clock.updatedAt;
  }

  get frameIndex(): number {
    return this.frameIndexValue;
  }

  get closed(): boolean {
    return this.closedValue;
  }

  getMode(): Exclude<FlowbarMode, "auto"> {
    if (this.modeValue !== "auto") {
      return this.modeValue;
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
    return {
      id: this.id,
      current: this.currentValue,
      total: this.totalValue,
      mode: this.getMode(),
      status: this.statusValue,
      postfix: readonlySnapshot(this.postfixValue),
      frameIndex: this.frameIndexValue,
      options: this.options,
      timing: this.clock.snapshot(this.currentValue, this.totalValue, this.normalizedOptions.minElapsedMsForEta),
    };
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
      this.clock.touch();
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
    this.clock.updateRate(previous, this.currentValue, this.normalizedOptions.rateSmoothing);
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
    this.clock.updateRate(previous, this.currentValue, this.normalizedOptions.rateSmoothing);
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
      this.modeValue = "determinate";
    } else if (this.modeValue === "determinate") {
      this.modeValue = "auto";
    }
    this.clock.touch();
    this.syncAnimationTimer();
    this.render(true);
    return this;
  }

  setMode(mode: FlowbarMode): this {
    if (this.closedValue) {
      return this;
    }
    this.modeValue = normalizeMode(mode);
    this.clock.touch();
    this.syncAnimationTimer();
    this.render(true);
    return this;
  }

  setStatus(status: string): this {
    if (this.closedValue) {
      return this;
    }
    this.statusValue = String(status);
    this.clock.touch();
    this.render(true);
    return this;
  }

  setPostfix(postfix: Record<string, unknown>): this {
    if (this.closedValue) {
      return this;
    }
    this.postfixValue = cloneData(postfix || {});
    this.clock.touch();
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
    this.clock.touch();
    this.stopAnimationTimer();
    if (this.normalizedOptions.signal && this.abortHandler) {
      this.normalizedOptions.signal.removeEventListener("abort", this.abortHandler);
      this.abortHandler = undefined;
    }
    try {
      this.renderer.finalize(this, state, safeMessage(message), leave ?? this.normalizedOptions.leave);
    } finally {
      try {
        this.renderer.dispose();
      } finally {
        notifyProgressBarClose(this);
      }
    }
    return this;
  }
}

export function createProgressBar(options: FlowbarOptions = {}): ProgressBar {
  return new ProgressBar(options);
}
