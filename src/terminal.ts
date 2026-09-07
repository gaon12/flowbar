import { truncateDisplay } from "./display.js";
import { buildFinalLine, buildLine } from "./layout.js";
import { getTerminalWidth } from "./options.js";
import type { ProgressBar } from "./progress.js";
import type {
  Renderer,
  RendererFinishState,
  RequiredNormalizedFlowbarOptions,
  WritableLike,
} from "./types.js";
import { now } from "./utils.js";

export const terminalHubs = new WeakMap<WritableLike, TerminalHub>();

export class TerminalHub {
  readonly output: WritableLike;
  private readonly options: RequiredNormalizedFlowbarOptions;
  private readonly entries = new Map<number, ProgressBar>();
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
  register(bar: ProgressBar): void {
    this.entries.set(bar.id, bar);
    this.render(true);
  }
  update(bar: ProgressBar, force = false): void {
    this.render(force, bar.options.interval);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    this.entries.delete(bar.id);
    const width = getTerminalWidth(this.output, bar.options);
    const line = buildFinalLine(bar.snapshot(), state, message, width);
    if (leave) {
      this.safeWriteLine(line, bar.options);
    } else {
      this.render(true);
    }
    if (leave) bar.options.onRender?.(line, bar.snapshot());
  }
  log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.safeWriteLine(`${level}: ${message}`, bar.options);
    bar.options.onRender?.(`${level}: ${message}`, undefined);
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
    this.output.write("\r");
    if (this.renderedLineCount > 1) {
      this.output.write(`\u001B[${this.renderedLineCount - 1}A`);
    }
  }
  deleteLiveRegion(): void {
    if (this.renderedLineCount <= 0) {
      return;
    }
    this.moveToLiveTop();
    this.output.write(`\u001B[${this.renderedLineCount}M`);
    this.renderedLineCount = 0;
  }
  safeWriteLine(line: string, options: RequiredNormalizedFlowbarOptions): void {
    this.deleteLiveRegion();
    this.output.write(
      `${truncateDisplay(line, getTerminalWidth(this.output, options), options.charset === "ascii" ? "." : "…")}\r\n`,
    );
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
    const bars = Array.from(this.entries.values()).filter((bar) => !bar.closed);
    const lines = bars.map((bar) =>
      buildLine(bar.snapshot(), getTerminalWidth(this.output, bar.options)),
    );
    if (lines.length === 0) {
      this.deleteLiveRegion();
      return;
    }
    this.moveToLiveTop();
    const maximumLines = Math.max(this.renderedLineCount, lines.length);
    for (let index = 0; index < maximumLines; index += 1) {
      this.output.write("\u001B[2K");
      if (index < lines.length) {
        this.output.write(lines[index]);
      }
      if (index < maximumLines - 1) {
        this.output.write("\r\n");
      }
    }
    if (lines.length < maximumLines) {
      this.output.write(`\u001B[${maximumLines - lines.length}A`);
    }
    this.renderedLineCount = lines.length;
    for (const [index, bar] of bars.entries()) bar.options.onRender?.(lines[index], bar.snapshot());
  }
}

export class TerminalRenderer implements Renderer {
  readonly animated = true;
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
    this.hub.register(bar);
  }
  update(bar: ProgressBar, force = false): void {
    this.hub.update(bar, force);
  }
  finalize(bar: ProgressBar, state: RendererFinishState, message: string, leave: boolean): void {
    this.hub.finalize(bar, state, message, leave);
  }
  log(bar: ProgressBar, level: "info" | "warn" | "error", message: string): void {
    this.hub.log(bar, level, message);
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
