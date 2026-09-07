import { createProgressBar } from "./progress.js";
import { runWithProgress } from "./runners.js";
import { inferTotal, isAbortErrorLike } from "./utils.js";
export function createGroup(options = {}) {
    const groupOptions = { ...options };
    const bars = new Set();
    function track(bar) {
        bars.add(bar);
        bar.onClose(() => {
            bars.delete(bar);
        });
        return bar;
    }
    return {
        create(childOptions = {}) {
            const label = childOptions.label || groupOptions.label;
            return track(createProgressBar({ ...groupOptions, ...childOptions, label }));
        },
        wait(childOptions = {}) {
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
export async function task(label, handler, options = {}) {
    const root = createProgressBar({
        ...options,
        label,
        mode: "indeterminate",
        status: options.status || "running",
    });
    const taskApi = {
        bar: root,
        async step(stepLabel, stepHandler) {
            root.setStatus(stepLabel);
            return stepHandler(root);
        },
        async indeterminate(stepLabel, stepHandler) {
            root.setMode("indeterminate");
            root.setStatus(stepLabel);
            return stepHandler(root);
        },
        async progress(stepLabel, items, itemHandler, progressOptions = {}) {
            const total = progressOptions.total ?? inferTotal(items);
            root.setLabel(stepLabel).setStatus("running").update(0).setTotal(total);
            await runWithProgress(items, itemHandler, { ...options, ...progressOptions, label: stepLabel, total }, false, root, false);
        },
    };
    try {
        const result = await handler(taskApi);
        if (!root.closed) {
            root.succeed();
        }
        return result;
    }
    catch (error) {
        if (!root.closed) {
            if (isAbortErrorLike(error)) {
                root.cancel("aborted");
            }
            else {
                root.fail(error);
            }
        }
        throw error;
    }
}
