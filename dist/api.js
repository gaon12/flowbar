import { createGroup, task as runTask, streamWithProgress } from "./runtime/features.js";
import { eachWithProgress, flowbar, mapWithProgress } from "./runtime/iterables.js";
import { createProgressBar } from "./runtime/progress-bar.js";
export const create = createProgressBar;
export const wait = (options = {}) => createProgressBar({ ...options, mode: "indeterminate" });
export const map = mapWithProgress;
export const each = eachWithProgress;
export const stream = streamWithProgress;
export const group = createGroup;
export const task = runTask;
export function configure(defaultOptions = {}) {
    return Object.freeze({
        create: (options = {}) => createProgressBar({ ...defaultOptions, ...options }),
        wait: (options = {}) => createProgressBar({ ...defaultOptions, ...options, mode: "indeterminate" }),
        map: (input, mapper, options = {}) => mapWithProgress(input, mapper, { ...defaultOptions, ...options }),
        each: (input, handler, options = {}) => eachWithProgress(input, handler, { ...defaultOptions, ...options }),
        stream: (options = {}) => streamWithProgress({ ...defaultOptions, ...options }),
        group: (options = {}) => createGroup({ ...defaultOptions, ...options }),
        task: (label, handler, options = {}) => runTask(label, handler, { ...defaultOptions, ...options }),
        configure: (options = {}) => configure({ ...defaultOptions, ...options }),
    });
}
export default flowbar;
