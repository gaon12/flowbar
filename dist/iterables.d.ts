import type { AsyncIteratorLike, FlowbarOptions } from "./types.js";
export declare function wrapSyncIterable<T>(input: Iterable<T>, options?: FlowbarOptions): Iterable<T>;
export declare function wrapAsyncIterable<T>(input: AsyncIterable<T>, options?: FlowbarOptions): AsyncIterable<T>;
export declare function flowbar<T>(input: Iterable<T> | AsyncIterable<T>, options?: FlowbarOptions): Iterable<T> | AsyncIterable<T>;
export declare function toAsyncIterator<T>(input: Iterable<T> | AsyncIterable<T>): AsyncIteratorLike<T>;
export declare function closeIterator<T>(iterator: AsyncIteratorLike<T>): Promise<void>;
