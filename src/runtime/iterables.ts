import { normalizeConcurrency } from "../core/options.js";
import { ensureNotAborted, inferTotal, isAbortErrorLike, isAsyncIterable, isIterable } from "../core/utils.js";
import type {
  AsyncIteratorLike,
  FlowbarHandler,
  FlowbarMapOptions,
  FlowbarMapper,
  FlowbarOptions,
  WorkItem,
} from "../types.js";
import { createProgressBar } from "./progress-bar.js";

function wrapSyncIterable<T>(input: Iterable<T>, options: FlowbarOptions = {}): Iterable<T> {
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

function wrapAsyncIterable<T>(input: AsyncIterable<T>, options: FlowbarOptions = {}): AsyncIterable<T> {
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

function toAsyncIterator<T>(input: Iterable<T> | AsyncIterable<T>): AsyncIteratorLike<T> {
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

async function closeIterator<T>(iterator: AsyncIteratorLike<T>): Promise<void> {
  if (typeof iterator.return === "function") {
    await iterator.return();
  }
}

async function runWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarMapper<T, R>,
  options: FlowbarMapOptions,
  collectResults: true,
): Promise<R[]>;
async function runWithProgress<T>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarHandler<T>,
  options: FlowbarMapOptions,
  collectResults: false,
): Promise<void>;
async function runWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarMapper<T, R> | FlowbarHandler<T>,
  options: FlowbarMapOptions,
  collectResults: boolean,
  // biome-ignore lint/suspicious/noConfusingVoidType: overload implementation covers both collecting and non-collecting calls.
): Promise<R[] | void> {
  const inferredTotal = inferTotal(input);
  const total = options.total ?? inferredTotal;
  const concurrency = normalizeConcurrency(options.concurrency);
  const workerCount = inferredTotal == null ? concurrency : Math.min(concurrency, inferredTotal);
  const bar = createProgressBar({ ...options, total });
  const iterator = toAsyncIterator(input);
  const executionController = new AbortController();
  const results: R[] = [];
  let nextIndex = 0;
  let iteratorLock: Promise<unknown> = Promise.resolve();
  let stopped = false;
  let firstError: unknown;
  let hasError = false;

  const abortFromCaller = () => {
    executionController.abort(options.signal?.reason);
  };
  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  function stop(error: unknown): void {
    if (!hasError) {
      firstError = error;
      hasError = true;
    }
    stopped = true;
    if (!executionController.signal.aborted) {
      executionController.abort(error);
    }
  }

  async function nextItem(): Promise<WorkItem<T>> {
    const run: Promise<WorkItem<T>> = iteratorLock.then(async (): Promise<WorkItem<T>> => {
      if (stopped) {
        return { done: true, value: undefined, index: -1 };
      }
      ensureNotAborted(executionController.signal);
      const index = nextIndex;
      const result = await iterator.next();
      if (result.done) {
        return { done: true, value: undefined, index: -1 };
      }
      nextIndex += 1;
      return { done: false, value: result.value, index };
    });
    iteratorLock = run.catch(() => undefined);
    return run;
  }

  async function worker(): Promise<void> {
    try {
      for (;;) {
        const item = await nextItem();
        if (item.done) {
          return;
        }
        const mapped = await handler(item.value, item.index, bar, executionController.signal);
        ensureNotAborted(executionController.signal);
        if (collectResults) {
          results[item.index] = mapped as R;
        }
        bar.increment(1);
      }
    } catch (error) {
      stop(error);
      throw error;
    }
  }

  try {
    ensureNotAborted(executionController.signal);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.allSettled(workers);
    if (hasError) {
      throw firstError;
    }
    bar.succeed();
    return collectResults ? results : undefined;
  } catch (error) {
    stopped = true;
    try {
      await closeIterator(iterator);
    } catch {
      // Preserve the handler or abort error that caused shutdown.
    }
    if (isAbortErrorLike(error)) {
      bar.cancel("aborted");
    } else {
      bar.fail(error);
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function mapWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  mapper: FlowbarMapper<T, R>,
  options: FlowbarMapOptions = {},
): Promise<R[]> {
  if (typeof mapper !== "function") {
    throw new TypeError("flowbar.map(input, mapper) expects mapper to be a function.");
  }
  return runWithProgress(input, mapper, options, true);
}

export async function eachWithProgress<T>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarHandler<T>,
  options: FlowbarMapOptions = {},
): Promise<void> {
  if (typeof handler !== "function") {
    throw new TypeError("flowbar.each(input, handler) expects handler to be a function.");
  }
  await runWithProgress(input, handler, options, false);
}
