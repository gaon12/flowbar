import { performance } from "node:perf_hooks";

export function now(): number {
  return performance.now();
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clampNumber(value: number, minimum: number, maximum: number): number {
  if (value < minimum) {
    return minimum;
  }
  if (value > maximum) {
    return maximum;
  }
  return value;
}

export function isAbortErrorLike(error: unknown): error is { name: "AbortError" } {
  return (
    error != null && typeof error === "object" && "name" in error && error.name === "AbortError"
  );
}

export function makeAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

export function ensureNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw makeAbortError();
  }
}

export function isAsyncIterable<T = unknown>(value: unknown): value is AsyncIterable<T> {
  return (
    value != null &&
    typeof (value as Partial<AsyncIterable<T>>)[Symbol.asyncIterator] === "function"
  );
}

export function isIterable<T = unknown>(value: unknown): value is Iterable<T> {
  return value != null && typeof (value as Partial<Iterable<T>>)[Symbol.iterator] === "function";
}

export function inferTotal(input: unknown): number | undefined {
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

export function safeMessage(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Error) {
    return value.message || value.name;
  }
  return String(value);
}

export function assertFiniteNumber(value: unknown, name: string): number {
  if (!isFiniteNumber(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return value;
}

export function normalizeNonNegativeNumber(value: number, name: string): number {
  if (value < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0.`);
  }
  return value;
}

export function normalizeOptionalNonNegativeNumber(
  value: unknown,
  name: string,
): number | undefined {
  if (value == null) {
    return undefined;
  }
  return normalizeNonNegativeNumber(assertFiniteNumber(value, name), name);
}
