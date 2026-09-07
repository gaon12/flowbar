import { performance } from "node:perf_hooks";
export function now() {
    return performance.now();
}
export function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
export function clampNumber(value, minimum, maximum) {
    if (value < minimum) {
        return minimum;
    }
    if (value > maximum) {
        return maximum;
    }
    return value;
}
export function isAbortErrorLike(error) {
    return (error != null && typeof error === "object" && "name" in error && error.name === "AbortError");
}
export function makeAbortError() {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
}
export function ensureNotAborted(signal) {
    if (signal?.aborted) {
        throw makeAbortError();
    }
}
export function isAsyncIterable(value) {
    return (value != null &&
        typeof value[Symbol.asyncIterator] === "function");
}
export function isIterable(value) {
    return value != null && typeof value[Symbol.iterator] === "function";
}
export function inferTotal(input) {
    if (input == null) {
        return undefined;
    }
    if (typeof input === "object" && "length" in input && isFiniteNumber(input.length)) {
        return input.length;
    }
    if (typeof input === "object" && "size" in input && isFiniteNumber(input.size)) {
        return input.size;
    }
    return undefined;
}
export function safeMessage(value) {
    if (value == null) {
        return "";
    }
    if (value instanceof Error) {
        return value.message || value.name;
    }
    return String(value);
}
export function assertFiniteNumber(value, name) {
    if (!isFiniteNumber(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}
export function normalizeNonNegativeNumber(value, name) {
    if (value < 0) {
        throw new RangeError(`${name} must be greater than or equal to 0.`);
    }
    return value;
}
export function normalizeOptionalNonNegativeNumber(value, name) {
    if (value == null) {
        return undefined;
    }
    return normalizeNonNegativeNumber(assertFiniteNumber(value, name), name);
}
