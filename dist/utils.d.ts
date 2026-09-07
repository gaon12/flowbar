export declare function now(): number;
export declare function isFiniteNumber(value: unknown): value is number;
export declare function clampNumber(value: number, minimum: number, maximum: number): number;
export declare function isAbortErrorLike(error: unknown): error is {
    name: "AbortError";
};
export declare function makeAbortError(): Error;
export declare function ensureNotAborted(signal: AbortSignal | undefined): void;
export declare function isAsyncIterable<T = unknown>(value: unknown): value is AsyncIterable<T>;
export declare function isIterable<T = unknown>(value: unknown): value is Iterable<T>;
export declare function inferTotal(input: unknown): number | undefined;
export declare function safeMessage(value: unknown): string;
export declare function assertFiniteNumber(value: unknown, name: string): number;
export declare function normalizeNonNegativeNumber(value: number, name: string): number;
export declare function normalizeOptionalNonNegativeNumber(value: unknown, name: string): number | undefined;
