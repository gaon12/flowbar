import { Transform } from "node:stream";
import { createProgressBar } from "./progress-bar.js";
function getChunkByteLength(chunk, encoding) {
    if (typeof chunk === "string") {
        return Buffer.byteLength(chunk, encoding === "buffer" ? "utf8" : encoding);
    }
    if (Buffer.isBuffer(chunk)) {
        return chunk.length;
    }
    if (ArrayBuffer.isView(chunk)) {
        return chunk.byteLength;
    }
    if (chunk instanceof ArrayBuffer) {
        return chunk.byteLength;
    }
    throw new TypeError('flowbar.stream({ unit: "byte" }) expects string or binary chunks.');
}
export function streamWithProgress(options = {}) {
    const objectMode = options.objectMode === true;
    const bar = createProgressBar({ ...options, unit: options.unit || (objectMode ? "item" : "byte") });
    const unit = bar.options.unit;
    const transform = new Transform({
        readableObjectMode: objectMode,
        writableObjectMode: objectMode,
        decodeStrings: false,
        transform(chunk, encoding, callback) {
            try {
                const amount = unit === "byte" ? getChunkByteLength(chunk, encoding) : 1;
                bar.increment(amount);
                callback(null, chunk);
            }
            catch (error) {
                bar.fail(error);
                callback(error instanceof Error ? error : new Error(String(error)));
            }
        },
        flush(callback) {
            try {
                bar.succeed();
                callback();
            }
            catch (error) {
                callback(error instanceof Error ? error : new Error(String(error)));
            }
        },
    });
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
