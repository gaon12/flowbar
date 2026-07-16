import { createGroup, task as runTask, streamWithProgress } from "./runtime/features.js";
import { eachWithProgress, flowbar, mapWithProgress } from "./runtime/iterables.js";
import { createProgressBar } from "./runtime/progress-bar.js";
import type {
  FlowbarClient,
  FlowbarHandler,
  FlowbarMapOptions,
  FlowbarMapper,
  FlowbarOptions,
  FlowbarTaskApi,
} from "./types.js";

export const create = createProgressBar;
export const wait = (options: FlowbarOptions = {}) => createProgressBar({ ...options, mode: "indeterminate" });
export const map = mapWithProgress;
export const each = eachWithProgress;
export const stream = streamWithProgress;
export const group = createGroup;
export const task = runTask;

export function configure(defaultOptions: FlowbarOptions = {}): FlowbarClient {
  return Object.freeze({
    create: (options: FlowbarOptions = {}) => createProgressBar({ ...defaultOptions, ...options }),
    wait: (options: FlowbarOptions = {}) => createProgressBar({ ...defaultOptions, ...options, mode: "indeterminate" }),
    map: <T, R>(input: Iterable<T> | AsyncIterable<T>, mapper: FlowbarMapper<T, R>, options: FlowbarMapOptions = {}) =>
      mapWithProgress(input, mapper, { ...defaultOptions, ...options }),
    each: <T>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options: FlowbarMapOptions = {}) =>
      eachWithProgress(input, handler, { ...defaultOptions, ...options }),
    stream: (options: FlowbarOptions = {}) => streamWithProgress({ ...defaultOptions, ...options }),
    group: (options: FlowbarOptions = {}) => createGroup({ ...defaultOptions, ...options }),
    task: <T>(label: string, handler: (task: FlowbarTaskApi) => T | Promise<T>, options: FlowbarOptions = {}) =>
      runTask(label, handler, { ...defaultOptions, ...options }),
    configure: (options: FlowbarOptions = {}) => configure({ ...defaultOptions, ...options }),
  });
}

export default flowbar;
