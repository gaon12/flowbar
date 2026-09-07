import { Transform } from "node:stream";
import { createProgressBar } from "./progress.js";
import { isAbortErrorLike, isFiniteNumber, makeAbortError } from "./utils.js";
export function streamWithProgress(options = {}) {
    const bar = createProgressBar({ ...options, unit: options.unit || "byte" });
    let tracking = false;
    const transform = new Transform({
        signal: options.signal,
        transform(chunk, _encoding, callback) {
            try {
                const amount = bar.options.unit === "byte" &&
                    chunk != null &&
                    typeof chunk === "object" &&
                    "length" in chunk &&
                    isFiniteNumber(chunk.length)
                    ? chunk.length
                    : 1;
                bar.increment(amount);
                callback(null, chunk);
            }
            catch (error) {
                callback(error instanceof Error ? error : new Error(String(error)));
            }
        },
    });
    transform.flowbar = bar;
    transform.on("error", (error) => {
        if (!bar.closed) {
            if (isAbortErrorLike(error))
                bar.cancel("aborted");
            else
                bar.fail(error);
        }
    });
    transform.on("close", () => {
        if (!bar.closed && !tracking && options.completion !== "manual") {
            // A Transform cannot prove that its destination persisted the data.
            bar.close("stream closed; destination completion untracked");
        }
    });
    transform.track = async (operation) => {
        if (tracking || (bar.closed && !options.signal?.aborted))
            throw new Error("track() must be called once, before the stream closes.");
        tracking = true;
        try {
            const result = await operation;
            bar.succeed();
            return result;
        }
        catch (error) {
            if (options.signal?.aborted) {
                bar.cancel("aborted");
                throw isAbortErrorLike(error) ? error : makeAbortError();
            }
            if (isAbortErrorLike(error))
                bar.cancel("aborted");
            else
                bar.fail(error);
            throw error;
        }
    };
    return transform;
}
