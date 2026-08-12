import type { FlowbarHandler, FlowbarMapOptions, FlowbarOptions, FlowbarTaskApi } from "../types.js";
import { eachWithProgress } from "./iterables.js";
import { createProgressBar, type ProgressBar } from "./progress-bar.js";

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
