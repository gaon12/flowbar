import { onProgressBarClose } from "./lifecycle.js";
import { createProgressBar } from "./progress-bar.js";
export function createGroup(options = {}) {
    const groupOptions = { ...options };
    const bars = new Set();
    function track(bar) {
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
