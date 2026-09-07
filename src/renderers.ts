import { singleLine, stripAnsi } from "./display.js";
import { buildFinalLine, buildLine } from "./layout.js";
import { getTerminalWidth } from "./options.js";
import type { ProgressBar } from "./progress.js";
import { TerminalRenderer } from "./terminal.js";
import type { Renderer, RendererFinishState, RequiredNormalizedFlowbarOptions } from "./types.js";
import { now } from "./utils.js";

export class SilentRenderer implements Renderer {
  readonly animated = false;
  register(): void {}
  update(): void {}
  finalize(): void {}
  log(): void {}
  dispose(): void {}
}

export class MemoryRenderer implements Renderer {
  readonly animated = true;
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

export class PlainRenderer implements Renderer {
  readonly animated = false;
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
    const line = stripAnsi(
      buildLine(snapshot, getTerminalWidth(this.options.output, this.options)),
    );
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const line = stripAnsi(
      buildFinalLine(snapshot, state, message, getTerminalWidth(this.options.output, this.options)),
    );
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    message = stripAnsi(singleLine(message));
    this.options.output.write(`${level}: ${message}\n`);
    this.options.onRender?.(`${level}: ${message}`, undefined);
  }
  dispose(): void {}
}

export class JsonRenderer implements Renderer {
  readonly animated = false;
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
    if (!force && currentTime - this.lastWriteAt < this.options.interval) {
      return;
    }
    this.lastWriteAt = currentTime;
    const snapshot = bar.snapshot();
    const line = JSON.stringify({ type: "progress", snapshot });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    if (!leave) {
      return;
    }
    const snapshot = bar.snapshot();
    const line = JSON.stringify({ type: "final", state, message, snapshot });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, snapshot);
  }
  log(_bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    const line = JSON.stringify({ type: "log", level, message });
    this.options.output.write(`${line}\n`);
    this.options.onRender?.(line, undefined);
  }
  dispose(): void {}
}

export function isCiEnvironment(): boolean {
  return (
    (Boolean(process.env.CI) && !["false", "0"].includes((process.env.CI ?? "").toLowerCase())) ||
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
  if (options.output?.isTTY && process.env.TERM !== "dumb" && !isCiEnvironment()) {
    return new TerminalRenderer(options);
  }
  return new PlainRenderer(options);
}
