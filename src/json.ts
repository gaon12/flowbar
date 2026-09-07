import type { FlowbarSnapshot } from "./types.js";

/** Serialize data only: never traverse streams, signals, callbacks or arbitrary options. */
export function jsonSnapshot(snapshot: FlowbarSnapshot): unknown {
  const options: Record<string, unknown> = {};
  for (const key of [
    "label",
    "unit",
    "renderer",
    "interval",
    "mode",
    "preset",
    "animation",
    "status",
    "enabled",
    "leave",
    "color",
    "charset",
    "width",
  ] as const) {
    options[key] = snapshot.options[key];
  }
  return { ...snapshot, options, postfix: jsonValue(snapshot.postfix, new Set()) };
}

function jsonValue(value: unknown, ancestors: Set<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) return "[Circular]";
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => jsonValue(item, ancestors));
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (descriptor.enumerable && "value" in descriptor && key !== "toJSON") {
        result[key] = jsonValue(descriptor.value, ancestors);
      }
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}
