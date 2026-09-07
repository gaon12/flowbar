import type { FlowbarHandler, FlowbarMapOptions, FlowbarMapper, FlowbarOptions } from "../types.js";
export declare function flowbar<T>(input: Iterable<T> | AsyncIterable<T>, options?: FlowbarOptions): Iterable<T> | AsyncIterable<T>;
export declare function mapWithProgress<T, R>(input: Iterable<T> | AsyncIterable<T>, mapper: FlowbarMapper<T, R>, options?: FlowbarMapOptions): Promise<R[]>;
export declare function eachWithProgress<T>(input: Iterable<T> | AsyncIterable<T>, handler: FlowbarHandler<T>, options?: FlowbarMapOptions): Promise<void>;
