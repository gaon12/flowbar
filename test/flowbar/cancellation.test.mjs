import assert from "node:assert/strict";
import test from "node:test";
import { each } from "../../dist/index.js";

test("mapper failure aborts and awaits in-flight handlers", async () => {
  let releaseFailure;
  const secondStarted = new Promise((resolve) => {
    releaseFailure = resolve;
  });
  let cleanupFinished = false;
  let receivedAbort = false;

  await assert.rejects(
    () =>
      each(
        [1, 2],
        async (value, _index, _bar, signal) => {
          if (value === 1) {
            await secondStarted;
            throw new Error("primary failure");
          }
          releaseFailure();
          await new Promise((resolve) => {
            signal.addEventListener(
              "abort",
              () => {
                receivedAbort = true;
                setTimeout(resolve, 20);
              },
              { once: true },
            );
          });
          cleanupFinished = true;
        },
        { renderer: "silent", concurrency: 2 },
      ),
    /primary failure/,
  );

  assert.equal(receivedAbort, true);
  assert.equal(cleanupFinished, true);
});
