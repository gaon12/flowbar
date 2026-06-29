import { createGroup, streamWithProgress, task } from "./runtime/features.js";
import { eachWithProgress, flowbar, mapWithProgress } from "./runtime/iterables.js";
import { createProgressBar, ProgressBar } from "./runtime/progress-bar.js";
export function configure(defaultOptions = {}) {
    const configured = function configuredFlowbar(input, options = {}) {
        return flowbar(input, { ...defaultOptions, ...options });
    };
    configured.create = (options = {}) => createProgressBar({ ...defaultOptions, ...options });
    configured.wait = (options = {}) => createProgressBar({ ...defaultOptions, ...options, mode: "indeterminate" });
    configured.indeterminate = configured.wait;
    configured.spinner = configured.wait;
    configured.map = (input, mapper, options = {}) => mapWithProgress(input, mapper, { ...defaultOptions, ...options });
    configured.each = (input, handler, options = {}) => eachWithProgress(input, handler, { ...defaultOptions, ...options });
    configured.stream = (options = {}) => streamWithProgress({ ...defaultOptions, ...options });
    configured.group = (options = {}) => createGroup({ ...defaultOptions, ...options });
    configured.task = (label, handler, options = {}) => task(label, handler, { ...defaultOptions, ...options });
    configured.configure = (options = {}) => configure({ ...defaultOptions, ...options });
    return configured;
}
export const flowbarApi = flowbar;
flowbarApi.create = createProgressBar;
flowbarApi.wait = (options = {}) => createProgressBar({ ...options, mode: "indeterminate" });
flowbarApi.indeterminate = flowbarApi.wait;
flowbarApi.spinner = flowbarApi.wait;
flowbarApi.map = mapWithProgress;
flowbarApi.each = eachWithProgress;
flowbarApi.stream = streamWithProgress;
flowbarApi.group = createGroup;
flowbarApi.task = task;
flowbarApi.configure = configure;
flowbarApi.ProgressBar = ProgressBar;
export default flowbarApi;
