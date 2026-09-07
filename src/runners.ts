import { closeIterator, toAsyncIterator } from "./iterables.js";
import { normalizeConcurrency } from "./options.js";
import { createProgressBar, type ProgressBar } from "./progress.js";
import type { FlowbarHandler, FlowbarMapOptions, FlowbarMapper } from "./types.js";
import { ensureNotAborted, inferTotal, isAbortErrorLike } from "./utils.js";

export type WorkItem<T> =
  | { done: true; value: undefined; index: -1 }
  | { done: false; value: T; index: number };

export async function runWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarMapper<T, R>,
  options: FlowbarMapOptions,
  collectResults: true,
  progressBar?: ProgressBar,
  finishBar?: boolean,
): Promise<R[]>;

export async function runWithProgress<T>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarHandler<T>,
  options: FlowbarMapOptions,
  collectResults: false,
  progressBar?: ProgressBar,
  finishBar?: boolean,
): Promise<void>;

export async function runWithProgress<T, R>(
  input: Iterable<T> | AsyncIterable<T>,
  handler: FlowbarMapper<T, R> | FlowbarHandler<T>,
  options: FlowbarMapOptions,
  collectResults: boolean,
  progressBar?: ProgressBar,
  finishBar = true,
  // biome-ignore lint/suspicious/noConfusingVoidType: implementation serves both array and void overloads.
): Promise<R[] | void> {
  const total = options.total ?? inferTotal(input);
  const concurrency = normalizeConcurrency(options.concurrency);
  ensureNotAborted(options.signal);
  const iterator = toAsyncIterator(input);
  const bar = progressBar || createProgressBar({ ...options, total });
  const results: R[] = [];
  let nextIndex = 0;
  let iteratorLock: Promise<unknown> = Promise.resolve();
  let stopped = false;
  let failed = false;
  let firstError: unknown;

  async function nextItem(): Promise<WorkItem<T>> {
    const run: Promise<WorkItem<T>> = iteratorLock.then(async (): Promise<WorkItem<T>> => {
      if (stopped) {
        return { done: true, value: undefined, index: -1 };
      }
      ensureNotAborted(options.signal);
      const index = nextIndex;
      const result = await iterator.next();
      ensureNotAborted(options.signal);
      if (result.done || stopped) {
        stopped = true;
        return { done: true, value: undefined, index: -1 };
      }
      nextIndex += 1;
      return { done: false, value: result.value, index };
    });
    iteratorLock = run.catch(() => undefined);
    return run;
  }

  async function worker(): Promise<void> {
    for (;;) {
      const item = await nextItem();
      if (item.done || stopped) {
        return;
      }
      ensureNotAborted(options.signal);
      const mapped = await handler(item.value, item.index, bar);
      ensureNotAborted(options.signal);
      if (collectResults) {
        results[item.index] = mapped as R;
      }
      bar.increment(1);
    }
  }

  try {
    await Promise.all(
      Array.from({ length: concurrency }, () =>
        worker().catch((error) => {
          stopped = true;
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }),
      ),
    );
    if (failed) throw firstError;
    ensureNotAborted(options.signal);
    if (finishBar) {
      bar.succeed();
    }
    return collectResults ? results : undefined;
  } catch (error) {
    stopped = true;
    try {
      await closeIterator(iterator);
    } catch {
      /* Preserve the original work error. */
    }
    if (finishBar) {
      if (isAbortErrorLike(error)) {
        bar.cancel("aborted");
      } else {
        bar.fail(error);
      }
    }
    throw error;
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
