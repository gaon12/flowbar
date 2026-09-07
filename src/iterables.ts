import { createProgressBar } from "./progress.js";
import type { AsyncIteratorLike, FlowbarOptions } from "./types.js";
import {
  ensureNotAborted,
  inferTotal,
  isAbortErrorLike,
  isAsyncIterable,
  isIterable,
} from "./utils.js";

export function wrapSyncIterable<T>(input: Iterable<T>, options: FlowbarOptions = {}): Iterable<T> {
  const total = options.total ?? inferTotal(input);
  const bar = createProgressBar({ ...options, total });
  function* generator() {
    let completedNormally = false;
    try {
      for (const item of input) {
        ensureNotAborted(options.signal);
        yield item;
        bar.increment(1);
      }
      completedNormally = true;
      bar.succeed();
    } catch (error) {
      if (isAbortErrorLike(error)) {
        bar.cancel("aborted");
      } else {
        bar.fail(error);
      }
      throw error;
    } finally {
      if (!completedNormally && !bar.closed) {
        bar.close();
      }
    }
  }
  return generator();
}

export function wrapAsyncIterable<T>(
  input: AsyncIterable<T>,
  options: FlowbarOptions = {},
): AsyncIterable<T> {
  const total = options.total ?? inferTotal(input);
  const bar = createProgressBar({ ...options, total });
  async function* generator() {
    let completedNormally = false;
    try {
      for await (const item of input) {
        ensureNotAborted(options.signal);
        yield item;
        bar.increment(1);
      }
      completedNormally = true;
      bar.succeed();
    } catch (error) {
      if (isAbortErrorLike(error)) {
        bar.cancel("aborted");
      } else {
        bar.fail(error);
      }
      throw error;
    } finally {
      if (!completedNormally && !bar.closed) {
        bar.close();
      }
    }
  }
  return generator();
}

export function flowbar<T>(
  input: Iterable<T> | AsyncIterable<T>,
  options: FlowbarOptions = {},
): Iterable<T> | AsyncIterable<T> {
  if (isAsyncIterable(input)) {
    return wrapAsyncIterable(input, options);
  }
  if (isIterable(input)) {
    return wrapSyncIterable(input, options);
  }
  throw new TypeError("flowbar(input) expects an Iterable or AsyncIterable input.");
}

export function toAsyncIterator<T>(input: Iterable<T> | AsyncIterable<T>): AsyncIteratorLike<T> {
  if (isAsyncIterable(input)) {
    return input[Symbol.asyncIterator]();
  }
  if (isIterable(input)) {
    const iterator = input[Symbol.iterator]();
    return {
      async next() {
        return iterator.next();
      },
      async return(value?: unknown) {
        if (typeof iterator.return === "function") {
          return iterator.return(value);
        }
        return { done: true, value: value as T };
      },
    };
  }
  throw new TypeError("Expected an Iterable or AsyncIterable input.");
}

export async function closeIterator<T>(iterator: AsyncIteratorLike<T>): Promise<void> {
  if (typeof iterator.return === "function") {
    await iterator.return();
  }
}
