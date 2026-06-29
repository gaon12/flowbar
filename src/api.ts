import { createGroup, streamWithProgress, task } from "./runtime/features.js";
import { eachWithProgress, flowbar, mapWithProgress } from "./runtime/iterables.js";
import { createProgressBar, ProgressBar } from "./runtime/progress-bar.js";
import type { FlowbarFunction, FlowbarOptions } from "./types.js";

export function configure(defaultOptions: FlowbarOptions = {}): FlowbarFunction {
  const configured = function configuredFlowbar<T>(
    input: Iterable<T> | AsyncIterable<T>,
    options: FlowbarOptions = {},
  ) {
    return flowbar(input, { ...defaultOptions, ...options });
  } as FlowbarFunction;
  configured.create = (options = {}) => createProgressBar({ ...defaultOptions, ...options });
  configured.wait = (options = {}) => createProgressBar({ ...defaultOptions, ...options, mode: "indeterminate" });
  configured.indeterminate = configured.wait;
  configured.spinner = configured.wait;
  configured.map = (input, mapper, options = {}) => mapWithProgress(input, mapper, { ...defaultOptions, ...options });
  configured.each = (input, handler, options = {}) =>
    eachWithProgress(input, handler, { ...defaultOptions, ...options });
  configured.stream = (options = {}) => streamWithProgress({ ...defaultOptions, ...options });
  configured.group = (options = {}) => createGroup({ ...defaultOptions, ...options });
  configured.task = (label, handler, options = {}) => task(label, handler, { ...defaultOptions, ...options });
  configured.configure = (options = {}) => configure({ ...defaultOptions, ...options });
  return configured;
}

export const flowbarApi = flowbar as FlowbarFunction;
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
