import { closeIterator, toAsyncIterator } from "./iterables.js";
import { normalizeConcurrency } from "./options.js";
import { createProgressBar } from "./progress.js";
import { ensureNotAborted, inferTotal, isAbortErrorLike } from "./utils.js";
export async function runWithProgress(input, handler, options, collectResults, progressBar, finishBar = true) {
    const total = options.total ?? inferTotal(input);
    const concurrency = normalizeConcurrency(options.concurrency);
    const bar = progressBar || createProgressBar({ ...options, total });
    const iterator = toAsyncIterator(input);
    const results = [];
    let nextIndex = 0;
    let iteratorLock = Promise.resolve();
    let stopped = false;
    async function nextItem() {
        const run = iteratorLock.then(async () => {
            if (stopped) {
                return { done: true, value: undefined, index: -1 };
            }
            ensureNotAborted(options.signal);
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
    async function worker() {
        for (;;) {
            const item = await nextItem();
            if (item.done) {
                return;
            }
            const mapped = await handler(item.value, item.index, bar);
            if (collectResults) {
                results[item.index] = mapped;
            }
            bar.increment(1);
        }
    }
    try {
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        if (finishBar) {
            bar.succeed();
        }
        return collectResults ? results : undefined;
    }
    catch (error) {
        stopped = true;
        await closeIterator(iterator);
        if (finishBar) {
            if (isAbortErrorLike(error)) {
                bar.cancel("aborted");
            }
            else {
                bar.fail(error);
            }
        }
        throw error;
    }
}
export async function mapWithProgress(input, mapper, options = {}) {
    if (typeof mapper !== "function") {
        throw new TypeError("flowbar.map(input, mapper) expects mapper to be a function.");
    }
    return runWithProgress(input, mapper, options, true);
}
export async function eachWithProgress(input, handler, options = {}) {
    if (typeof handler !== "function") {
        throw new TypeError("flowbar.each(input, handler) expects handler to be a function.");
    }
    await runWithProgress(input, handler, options, false);
}
