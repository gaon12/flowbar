import { getTerminalWidth } from "../core/options.js";
import { safeJsonStringify } from "../core/snapshot.js";
import { now, truncateDisplay } from "../core/utils.js";
import type { ProgressBar } from "../runtime/progress-bar.js";
import type { Renderer, RendererFinishState, RequiredNormalizedFlowbarOptions, WritableLike } from "../types.js";
import { buildFinalLine, buildLine } from "./format.js";

class SilentRenderer implements Renderer {
  register(): void {}
  update(): void {}
  finalize(): void {}
  log(): void {}
  dispose(): void {}
}

class MemoryRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
  }
  register(bar: ProgressBar): void {
    this.update(bar, true);
  }
  update(bar: ProgressBar, _force = false): void {
    const snapshot = bar.snapshot();
    const width = getTerminalWidth(this.options.output, this.options);
    const line = buildLine(snapshot, width);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const width = getTerminalWidth(this.options.output, this.options);
    this.options.onRender?.(buildFinalLine(snapshot, state, message, width), snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.options.onRender?.(`${level}: ${message}`, undefined);
  }
  dispose(): void {}
}

class PlainRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;
  private lastWriteAt: number;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
    this.lastWriteAt = 0;
  }
  register(bar: ProgressBar): void {
    this.update(bar, true);
  }
  update(bar: ProgressBar, force = false): void {
    const currentTime = now();
    if (!force && currentTime - this.lastWriteAt < Math.max(1000, this.options.interval * 10)) {
      return;
    }
    this.lastWriteAt = currentTime;
    const snapshot = bar.snapshot();
    const line = buildLine(snapshot, getTerminalWidth(this.options.output, this.options));
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const line = buildFinalLine(snapshot, state, message, getTerminalWidth(this.options.output, this.options));
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.options.output.write(`${level}: ${message}\n`);
    this.options.onRender?.(`${level}: ${message}`, undefined);
  }
  dispose(): void {}
}

class JsonRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;
  private lastWriteAt = 0;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
  }
  register(bar: ProgressBar): void {
    this.update(bar, true);
  }
  update(bar: ProgressBar, force = false): void {
    const currentTime = now();
    if (!force && currentTime - this.lastWriteAt < this.options.interval) {
      return;
    }
    this.lastWriteAt = currentTime;
    const snapshot = bar.snapshot();
    const line = safeJsonStringify({ type: "progress", snapshot });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const line = safeJsonStringify({ type: "final", state, message, snapshot });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    const line = safeJsonStringify({ type: "log", level, message });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, undefined);
  }
  dispose(): void {}
}

const terminalHubs = new WeakMap<WritableLike, TerminalHub>();

class TerminalHub {
  readonly output: WritableLike;
  private readonly options: RequiredNormalizedFlowbarOptions;
  private readonly entries = new Map<number, { bar: ProgressBar; options: RequiredNormalizedFlowbarOptions }>();
  private renderedLineCount = 0;
  private disposed = false;
  private refCount = 0;
  private lastRenderAt = 0;
  private readonly resizeHandler: () => void;

  constructor(output: WritableLike, options: RequiredNormalizedFlowbarOptions) {
    this.output = output;
    this.options = options;
    this.resizeHandler = () => {
      this.render(true);
    };
    if (typeof output.on === "function") {
      output.on("resize", this.resizeHandler);
    }
  }
  acquire(): void {
    this.refCount += 1;
  }
  release(): boolean {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.dispose();
      return true;
    }
    return false;
  }
  register(bar: ProgressBar, options: RequiredNormalizedFlowbarOptions): void {
    this.entries.set(bar.id, { bar, options });
    this.render(true);
  }
  update(force: boolean, options: RequiredNormalizedFlowbarOptions): void {
    this.render(force, options.interval);
  }
  finalize(
    bar: ProgressBar,
    state: RendererFinishState,
    message: string,
    leave: boolean,
    options: RequiredNormalizedFlowbarOptions,
  ): void {
    this.entries.delete(bar.id);
    const width = getTerminalWidth(this.output, options);
    const line = buildFinalLine(bar.snapshot(), state, message, width);
    if (leave) {
      this.safeWriteLine(line, options);
    } else {
      this.render(true);
    }
  }
  log(level: "info" | "warn" | "error", message: string, options: RequiredNormalizedFlowbarOptions): void {
    this.safeWriteLine(`${level}: ${message}`, options);
  }
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (typeof this.output.off === "function") {
      this.output.off("resize", this.resizeHandler);
    }
  }
  moveToLiveTop(): void {
    if (this.renderedLineCount <= 0) {
      return;
    }
    let frame = "\r";
    if (this.renderedLineCount > 1) {
      frame += `\u001B[${this.renderedLineCount - 1}A`;
    }
    this.output.write(frame);
  }
  deleteLiveRegion(): void {
    if (this.renderedLineCount <= 0) {
      return;
    }
    let frame = "\r";
    if (this.renderedLineCount > 1) {
      frame += `\u001B[${this.renderedLineCount - 1}A`;
    }
    frame += `\u001B[${this.renderedLineCount}M`;
    this.output.write(frame);
    this.renderedLineCount = 0;
  }
  safeWriteLine(line: string, options: RequiredNormalizedFlowbarOptions): void {
    this.deleteLiveRegion();
    this.output.write(`${truncateDisplay(line, getTerminalWidth(this.output, options))}\n`);
    this.render(true);
  }
  render(force: boolean, interval = this.options.interval): void {
    if (this.disposed) {
      return;
    }
    const currentTime = now();
    if (!force && currentTime - this.lastRenderAt < interval) {
      return;
    }
    this.lastRenderAt = currentTime;
    const bars = Array.from(this.entries.values()).filter(({ bar }) => !bar.closed);
    const lines = bars.map(({ bar, options }) => buildLine(bar.snapshot(), getTerminalWidth(this.output, options)));
    if (lines.length === 0) {
      this.deleteLiveRegion();
      return;
    }
    let frame = "";
    if (this.renderedLineCount > 0) {
      frame += "\r";
      if (this.renderedLineCount > 1) {
        frame += `\u001B[${this.renderedLineCount - 1}A`;
      }
    }
    const maximumLines = Math.max(this.renderedLineCount, lines.length);
    for (let index = 0; index < maximumLines; index += 1) {
      if (index < lines.length) {
        frame += `\r${lines[index]}\u001B[0K`;
      } else {
        frame += "\r\u001B[2K";
      }
      if (index < maximumLines - 1) {
        frame += "\n";
      }
    }
    if (lines.length < maximumLines) {
      frame += `\u001B[${maximumLines - lines.length}A`;
    }
    this.output.write(frame);
    this.renderedLineCount = lines.length;
  }
}

class TerminalRenderer implements Renderer {
  readonly options: RequiredNormalizedFlowbarOptions;
  private readonly hub: TerminalHub;
  private disposed = false;

  constructor(options: RequiredNormalizedFlowbarOptions) {
    this.options = options;
    let hub = terminalHubs.get(options.output);
    if (!hub) {
      hub = new TerminalHub(options.output, options);
      terminalHubs.set(options.output, hub);
    }
    hub.acquire();
    this.hub = hub;
  }
  register(bar: ProgressBar): void {
    this.hub.register(bar, this.options);
  }
  update(_bar: ProgressBar, force = false): void {
    this.hub.update(force, this.options);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    this.hub.finalize(bar, state, message, leave, this.options);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.hub.log(level, message, this.options);
  }
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.hub.release()) {
      terminalHubs.delete(this.options.output);
    }
  }
}

function isCiEnvironment(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.GITLAB_CI === "true" ||
    process.env.BITBUCKET_BUILD_NUMBER != null
  );
}

export function createRenderer(options: RequiredNormalizedFlowbarOptions): Renderer {
  if (!options.enabled || options.renderer === "silent") {
    return new SilentRenderer();
  }
  if (options.renderer === "memory") {
    return new MemoryRenderer(options);
  }
  if (options.renderer === "json") {
    return new JsonRenderer(options);
  }
  if (options.renderer === "plain") {
    return new PlainRenderer(options);
  }
  if (options.renderer === "terminal") {
    return new TerminalRenderer(options);
  }
  if (options.output?.isTTY && !isCiEnvironment()) {
    return new TerminalRenderer(options);
  }
  return new PlainRenderer(options);
}
