import type { FlowbarGroup, FlowbarOptions } from "../types.js";
import { onProgressBarClose } from "./lifecycle.js";
import { createProgressBar, type ProgressBar } from "./progress-bar.js";

export function createGroup(options: FlowbarOptions = {}): FlowbarGroup {
  const groupOptions = { ...options };
  const bars = new Set<ProgressBar>();
  function track(bar: ProgressBar): ProgressBar {
    bars.add(bar);
    onProgressBarClose(bar, () => {
      bars.delete(bar);
    });
    return bar;
  }
  return {
    get size() {
      return bars.size;
    },
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
