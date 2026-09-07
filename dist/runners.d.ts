import { type ProgressBar } from "./progress.js";
import type { FlowbarHandler, FlowbarMapOptions, FlowbarMapper } from "./types.js";
export type WorkItem<T> = {
    done: true;
    value: undefined;
    index: -1;
} | {
    done: false;
    value: T;
    index: number;
};
export declare function runWithProgress<T, R>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarMapper<T, R>, options: FlowbarMapOptions, collectResults: true, progressBar?: ProgressBar, finishBar?: boolean): Promise<R[]>;
export declare function runWithProgress<T>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options: FlowbarMapOptions, collectResults: false, progressBar?: ProgressBar, finishBar?: boolean): Promise<void>;
export declare function mapWithProgress<T, R>(input: Iterable<T> | AsyncIterable<T>, mapper: FlowbarMapper<T, R>, options?: FlowbarMapOptions): Promise<R[]>;
export declare function eachWithProgress<T>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options?: FlowbarMapOptions): Promise<void>;
