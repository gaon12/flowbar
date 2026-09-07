import { createProgressBar, type ProgressBar } from "./progress.js";
import { runWithProgress } from "./runners.js";
import type {
  FlowbarGroup,
  FlowbarHandler,
  FlowbarMapOptions,
  FlowbarOptions,
  FlowbarTaskApi,
} from "./types.js";
import { inferTotal, isAbortErrorLike } from "./utils.js";

export function createGroup(options: FlowbarOptions = {}): FlowbarGroup {
  const groupOptions = { ...options };
  const bars = new Set<ProgressBar>();
  function track(bar: ProgressBar): ProgressBar {
    bars.add(bar);
    bar.onClose(() => {
      bars.delete(bar);
    });
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
  const root = createProgressBar({
    ...options,
    label,
    mode: "indeterminate",
    status: options.status || "running",
  });
  const taskApi: FlowbarTaskApi = {
    bar: root,
    async step<U>(
      stepLabel: string,
      stepHandler: (bar: ProgressBar) => U | Promise<U>,
    ): Promise<U> {
      root.setStatus(stepLabel);
      return stepHandler(root);
    },
    async indeterminate<U>(
      stepLabel: string,
      stepHandler: (bar: ProgressBar) => U | Promise<U>,
    ): Promise<U> {
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
      const total = progressOptions.total ?? inferTotal(items);
      root.setLabel(stepLabel).setStatus("running").update(0).setTotal(total);
      await runWithProgress(
        items,
        itemHandler,
        { ...options, ...progressOptions, label: stepLabel, total },
        false,
        root,
        false,
      );
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
      if (isAbortErrorLike(error)) {
        root.cancel("aborted");
      } else {
        root.fail(error);
      }
    }
    throw error;
  }
}
