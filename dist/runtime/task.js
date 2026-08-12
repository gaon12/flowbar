import { eachWithProgress } from "./iterables.js";
import { createProgressBar } from "./progress-bar.js";
export async function task(label, handler, options = {}) {
    const root = createProgressBar({ ...options, label, mode: "indeterminate", status: options.status || "running" });
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
    }
    catch (error) {
        if (!root.closed) {
            root.fail(error);
        }
        throw error;
    }
}
