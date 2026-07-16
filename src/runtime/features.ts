import { Transform } from "node:stream";
import { isFiniteNumber } from "../core/utils.js";
import type { FlowbarGroup, FlowbarHandler, FlowbarMapOptions, FlowbarOptions, FlowbarTaskApi } from "../types.js";
import { eachWithProgress } from "./iterables.js";
import { createProgressBar, type ProgressBar } from "./progress-bar.js";

export function streamWithProgress(options: FlowbarOptions = {}): Transform & { flowbar: ProgressBar } {
  const bar = createProgressBar({ ...options, unit: options.unit || "byte" });
  const unit = bar.options.unit;
  const transform = new Transform({
    transform(chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null, data?: unknown) => void) {
      try {
        const amount =
          unit === "byte" &&
          chunk != null &&
          typeof chunk === "object" &&
          "length" in chunk &&
          isFiniteNumber(chunk.length)
            ? chunk.length
            : 1;
        bar.increment(amount);
        callback(null, chunk);
      } catch (error) {
        bar.fail(error);
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
    flush(callback: (error?: Error | null) => void) {
      try {
        bar.succeed();
        callback();
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
  }) as Transform & { flowbar: ProgressBar };
  transform.flowbar = bar;
  transform.on("error", (error) => {
    if (!bar.closed) {
      bar.fail(error);
    }
  });
  transform.on("close", () => {
    if (!bar.closed) {
      bar.close();
    }
  });
  return transform;
}

export function createGroup(options: FlowbarOptions = {}): FlowbarGroup {
  const groupOptions = { ...options };
  const bars = new Set<ProgressBar>();
  function track(bar: ProgressBar): ProgressBar {
    bars.add(bar);
    return bar;
  }
  return {
    create(childOptions: FlowbarOptions = {}) {
      const label = childOptions.label || groupOptions.label;
      return track(createProgressBar({ ...groupOptions, ...childOptions, label }));
    },
    wait(childOptions: FlowbarOptions = {}) {
      return track(createProgressBar({ ...groupOptions, ...childOptions, mode: "indeterminate" }));
    },
    close() {
      for (const bar of bars) {
        if (!bar.closed) {
          bar.close("group closed");
        }
      }
      bars.clear();
    },
  };
}

export async function task<T>(
  label: string,
  handler: (task: FlowbarTaskApi) => T | Promise<T>,
  options: FlowbarOptions = {},
): Promise<T> {
  const root = createProgressBar({ ...options, label, mode: "indeterminate", status: options.status || "running" });
  const taskApi: FlowbarTaskApi = {
    bar: root,
    async step<U>(stepLabel: string, stepHandler: (bar: ProgressBar) => U | Promise<U>): Promise<U> {
      root.setStatus(stepLabel);
      return stepHandler(root);
    },
    async indeterminate<U>(stepLabel: string, stepHandler: (bar: ProgressBar) => U | Promise<U>): Promise<U> {
      root.setMode("indeterminate");
      root.setStatus(stepLabel);
      return stepHandler(root);
    },
    async progress<U>(
      stepLabel: string,
      items: Iterable<U> | AsyncIterable<U>,
      itemHandler: FlowbarHandler<U>,
      progressOptions: FlowbarMapOptions = {},
    ): Promise<void> {
      root.setStatus(stepLabel);
      await eachWithProgress(items, itemHandler, { ...options, ...progressOptions, label: stepLabel });
    },
  };
  try {
    const result = await handler(taskApi);
    if (!root.closed) {
      root.succeed();
    }
    return result;
  } catch (error) {
    if (!root.closed) {
      root.fail(error);
    }
    throw error;
  }
}
