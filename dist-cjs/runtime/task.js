"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.task = task;
const iterables_js_1 = require("./iterables.js");
const progress_bar_js_1 = require("./progress-bar.js");
async function task(label, handler, options = {}) {
    const root = (0, progress_bar_js_1.createProgressBar)({ ...options, label, mode: "indeterminate", status: options.status || "running" });
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
            await (0, iterables_js_1.eachWithProgress)(items, itemHandler, { ...options, ...progressOptions, label: stepLabel });
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
