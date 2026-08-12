"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGroup = createGroup;
const lifecycle_js_1 = require("./lifecycle.js");
const progress_bar_js_1 = require("./progress-bar.js");
function createGroup(options = {}) {
    const groupOptions = { ...options };
    const bars = new Set();
    function track(bar) {
        bars.add(bar);
        (0, lifecycle_js_1.onProgressBarClose)(bar, () => {
            bars.delete(bar);
        });
        return bar;
    }
    return {
        get size() {
            return bars.size;
        },
        create(childOptions = {}) {
            const label = childOptions.label || groupOptions.label;
            return track((0, progress_bar_js_1.createProgressBar)({ ...groupOptions, ...childOptions, label }));
        },
        wait(childOptions = {}) {
            return track((0, progress_bar_js_1.createProgressBar)({ ...groupOptions, ...childOptions, mode: "indeterminate" }));
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
