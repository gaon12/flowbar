import type { DeepReadonly } from "../types.js";

export function cloneData<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return cloneDataFallback(value, new WeakMap<object, unknown>());
  }
}

function cloneDataFallback<T>(value: T, seen: WeakMap<object, unknown>): T {
  if ((typeof value !== "object" && typeof value !== "function") || value == null) {
    return value;
  }
  if (typeof value === "function") {
    return value;
  }
  const existing = seen.get(value);
  if (existing) {
    return existing as T;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) {
      copy.push(cloneDataFallback(item, seen));
    }
    return copy as T;
  }
  const copy = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>;
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      descriptor.value = cloneDataFallback(descriptor.value, seen);
    }
    if (descriptor) {
      Object.defineProperty(copy, key, descriptor);
    }
  }
  return copy as T;
}

function deepFreeze<T>(value: T, seen: WeakSet<object>): DeepReadonly<T> {
  if (typeof value === "function") {
    return value as DeepReadonly<T>;
  }
  if (typeof value !== "object" || value == null || seen.has(value)) {
    return value as DeepReadonly<T>;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value, key), seen);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export function readonlySnapshot<T>(value: T): DeepReadonly<T> {
  return deepFreeze(cloneData(value), new WeakSet<object>());
}

export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "bigint") {
      return item.toString();
    }
    if (item != null && typeof item === "object") {
      if (seen.has(item)) {
        return "[Circular]";
      }
      seen.add(item);
    }
    return item;
  });
}
