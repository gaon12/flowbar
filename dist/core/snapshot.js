export function cloneData(value) {
    try {
        return structuredClone(value);
    }
    catch {
        return cloneDataFallback(value, new WeakMap());
    }
}
function cloneDataFallback(value, seen) {
    if ((typeof value !== "object" && typeof value !== "function") || value == null) {
        return value;
    }
    if (typeof value === "function") {
        return value;
    }
    const existing = seen.get(value);
    if (existing) {
        return existing;
    }
    if (Array.isArray(value)) {
        const copy = [];
        seen.set(value, copy);
        for (const item of value) {
            copy.push(cloneDataFallback(item, seen));
        }
        return copy;
    }
    const copy = Object.create(Object.getPrototypeOf(value));
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
    return copy;
}
function deepFreeze(value, seen) {
    if (typeof value === "function") {
        return value;
    }
    if (typeof value !== "object" || value == null || seen.has(value)) {
        return value;
    }
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
        deepFreeze(Reflect.get(value, key), seen);
    }
    return Object.freeze(value);
}
export function readonlySnapshot(value) {
    return deepFreeze(cloneData(value), new WeakSet());
}
export function safeJsonStringify(value) {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, item) => {
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
