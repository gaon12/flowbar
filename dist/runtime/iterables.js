import { normalizeConcurrency } from "../core/options.js";
import { ensureNotAborted, inferTotal, isAbortErrorLike, isAsyncIterable, isIterable } from "../core/utils.js";
import { createProgressBar } from "./progress-bar.js";
function wrapSyncIterable(input, options = {}) {
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
        }
        catch (error) {
            if (isAbortErrorLike(error)) {
                bar.cancel("aborted");
            }
            else {
                bar.fail(error);
            }
            throw error;
        }
        finally {
            if (!completedNormally && !bar.closed) {
                bar.close();
            }
        }
    }
    return generator();
}
function wrapAsyncIterable(input, options = {}) {
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
        }
        catch (error) {
            if (isAbortErrorLike(error)) {
                bar.cancel("aborted");
            }
            else {
                bar.fail(error);
            }
            throw error;
        }
        finally {
            if (!completedNormally && !bar.closed) {
                bar.close();
            }
        }
    }
    return generator();
}
export function flowbar(input, options = {}) {
    if (isAsyncIterable(input)) {
        return wrapAsyncIterable(input, options);
    }
    if (isIterable(input)) {
        return wrapSyncIterable(input, options);
    }
    throw new TypeError("flowbar(input) expects an Iterable or AsyncIterable input.");
}
function toAsyncIterator(input) {
    if (isAsyncIterable(input)) {
        return input[Symbol.asyncIterator]();
    }
    if (isIterable(input)) {
        const iterator = input[Symbol.iterator]();
        return {
            async next() {
                return iterator.next();
            },
            async return(value) {
                if (typeof iterator.return === "function") {
                    return iterator.return(value);
                }
                return { done: true, value: value };
            },
        };
    }
    throw new TypeError("Expected an Iterable or AsyncIterable input.");
}
async function closeIterator(iterator) {
    if (typeof iterator.return === "function") {
        await iterator.return();
    }
}
async function runWithProgress(input, handler, options, collectResults) {
    const inferredTotal = inferTotal(input);
    const total = options.total ?? inferredTotal;
    const concurrency = normalizeConcurrency(options.concurrency);
    const workerCount = inferredTotal == null ? concurrency : Math.min(concurrency, inferredTotal);
    const bar = createProgressBar({ ...options, total });
    const iterator = toAsyncIterator(input);
    const executionController = new AbortController();
    const results = [];
    let nextIndex = 0;
    let iteratorLock = Promise.resolve();
    let stopped = false;
    let firstError;
    let hasError = false;
    const abortFromCaller = () => {
        executionController.abort(options.signal?.reason);
    };
    if (options.signal?.aborted) {
        abortFromCaller();
    }
    else {
        options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    }
    function stop(error) {
        if (!hasError) {
            firstError = error;
            hasError = true;
        }
        stopped = true;
        if (!executionController.signal.aborted) {
            executionController.abort(error);
        }
    }
    async function nextItem() {
        const run = iteratorLock.then(async () => {
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
    async function worker() {
        try {
            for (;;) {
                const item = await nextItem();
                if (item.done) {
                    return;
                }
                const mapped = await handler(item.value, item.index, bar, executionController.signal);
                ensureNotAborted(executionController.signal);
                if (collectResults) {
                    results[item.index] = mapped;
                }
                bar.increment(1);
            }
        }
        catch (error) {
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
    }
    catch (error) {
        stopped = true;
        try {
            await closeIterator(iterator);
        }
        catch {
            // Preserve the handler or abort error that caused shutdown.
        }
        if (isAbortErrorLike(error)) {
            bar.cancel("aborted");
        }
        else {
            bar.fail(error);
        }
        throw error;
    }
    finally {
        options.signal?.removeEventListener("abort", abortFromCaller);
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
