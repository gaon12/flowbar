import { createProgressBar } from "./progress.js";
import { ensureNotAborted, inferTotal, isAbortErrorLike, isAsyncIterable, isIterable, } from "./utils.js";
export function wrapSyncIterable(input, options = {}) {
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
export function wrapAsyncIterable(input, options = {}) {
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
export function toAsyncIterator(input) {
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
export async function closeIterator(iterator) {
    if (typeof iterator.return === "function") {
        await iterator.return();
    }
}
