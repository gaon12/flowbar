import type { DeepReadonly } from "../types.js";
export declare function cloneData<T>(value: T): T;
export declare function readonlySnapshot<T>(value: T): DeepReadonly<T>;
export declare function safeJsonStringify(value: unknown): string;
