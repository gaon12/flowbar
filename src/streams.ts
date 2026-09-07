import { Transform } from "node:stream";
import { createProgressBar, type ProgressBar } from "./progress.js";
import type { FlowbarOptions } from "./types.js";
import { isFiniteNumber } from "./utils.js";

export function streamWithProgress(
  options: FlowbarOptions = {},
): Transform & { flowbar: ProgressBar } {
  const bar = createProgressBar({ ...options, unit: options.unit || "byte" });
  const unit = bar.options.unit;
  const transform = new Transform({
    transform(
      chunk: unknown,
      _encoding: BufferEncoding,
      callback: (error?: Error | null, data?: unknown) => void,
    ) {
      try {
        const amount =
          unit === "byte" &&
          chunk != null &&
          typeof chunk === "object" &&
          "length" in chunk &&
          isFiniteNumber(chunk.length)
            ? chunk.length
            : 1;
        bar.increment(amount);
        callback(null, chunk);
      } catch (error) {
        bar.fail(error);
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
    flush(callback: (error?: Error | null) => void) {
      try {
        bar.succeed();
        callback();
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
  }) as Transform & { flowbar: ProgressBar };
  transform.flowbar = bar;
  transform.on("error", (error) => {
    if (!bar.closed) {
      bar.fail(error);
    }
  });
  transform.on("close", () => {
    if (!bar.closed) {
      bar.close();
    }
  });
  return transform;
}
