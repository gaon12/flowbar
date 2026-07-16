import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import test from "node:test";
import flowbar, { configure, create, map, ProgressBar, stream, wait } from "../../dist/index.js";

test("default export is only the iterable wrapper", () => {
  assert.equal(typeof flowbar, "function");
  assert.deepEqual(Object.keys(flowbar), []);
  assert.equal(flowbar.create, undefined);
});

test("configure returns a non-callable client with shared defaults", () => {
  const client = configure({ renderer: "silent", unit: "byte" });
  assert.equal(typeof client, "object");
  assert.equal(Object.isFrozen(client), true);

  const bar = client.create({ total: 3 });
  assert.equal(bar.options.unit, "byte");
  bar.close();
});

test("manual progress bar exposes elapsed, remaining, and rate", async () => {
  const lines = [];
  const bar = create({
    label: "manual",
    total: 3,
    renderer: "memory",
    onRender(line) {
      lines.push(line);
    },
  });

  bar.increment();
  await new Promise((resolve) => setTimeout(resolve, 20));
  bar.increment();
  await new Promise((resolve) => setTimeout(resolve, 20));
  bar.increment();

  const snapshot = bar.snapshot();
  assert.equal(snapshot.current, 3);
  assert.equal(snapshot.total, 3);
  assert.equal(snapshot.mode, "determinate");
  assert.ok(snapshot.timing.elapsedMs >= 0);
  assert.ok(snapshot.timing.ratePerSecond == null || snapshot.timing.ratePerSecond > 0);

  bar.succeed("done");
  assert.equal(bar.closed, true);
  assert.ok(lines.some((line) => line.includes("manual")));
});

test("flowbar wraps a sync iterable without changing values", () => {
  const values = [];
  for (const value of flowbar([1, 2, 3], { renderer: "silent" })) {
    values.push(value);
  }
  assert.deepEqual(values, [1, 2, 3]);
});

test("flowbar wraps an async iterable without changing values", async () => {
  async function* source() {
    yield "a";
    yield "b";
    yield "c";
  }

  const values = [];
  for await (const value of flowbar(source(), { total: 3, renderer: "silent" })) {
    values.push(value);
  }
  assert.deepEqual(values, ["a", "b", "c"]);
});

test("flowbar.map returns ordered results while using concurrency", async () => {
  const result = await map(
    [1, 2, 3, 4],
    async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 5 * (5 - value)));
      return value * 2;
    },
    {
      concurrency: 4,
      renderer: "silent",
    },
  );

  assert.deepEqual(result, [2, 4, 6, 8]);
});

test("wait mode can transition to determinate mode using setTotal", () => {
  const bar = wait({ renderer: "memory", animation: "marquee" });
  assert.equal(bar.snapshot().mode, "indeterminate");

  bar.setTotal(2);
  assert.equal(bar.snapshot().mode, "determinate");

  bar.increment();
  bar.increment();
  assert.equal(bar.snapshot().current, 2);

  bar.succeed();
});

test("stream mode increments by byte length", async () => {
  const progress = stream({ total: 6, unit: "byte", renderer: "silent" });
  const chunks = [];

  Readable.from([Buffer.from("abc"), Buffer.from("def")])
    .pipe(progress)
    .on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

  await finished(progress);
  assert.equal(progress.flowbar.snapshot().current, 6);
  assert.deepEqual(chunks, ["abc", "def"]);
});

test("stream byte mode counts UTF-8 strings as bytes", async () => {
  const progress = stream({ total: 6, unit: "byte", renderer: "silent" });
  progress.resume();
  progress.end("한글", "utf8");

  await finished(progress);
  assert.equal(progress.flowbar.snapshot().current, 6);
});

test("stream object mode counts items and rejects objects in byte mode", async () => {
  const itemProgress = stream({ objectMode: true, renderer: "silent" });
  itemProgress.resume();
  itemProgress.write({ id: 1 });
  itemProgress.end({ id: 2 });
  await finished(itemProgress);

  assert.equal(itemProgress.flowbar.options.unit, "item");
  assert.equal(itemProgress.flowbar.snapshot().current, 2);

  const byteProgress = stream({ objectMode: true, unit: "byte", renderer: "silent" });
  byteProgress.resume();
  byteProgress.end({ id: 1 });
  await assert.rejects(finished(byteProgress), /expects string or binary chunks/);
});

test("named ProgressBar export is available", () => {
  const bar = new ProgressBar({ renderer: "silent" });
  assert.equal(typeof bar.increment, "function");
  bar.close();
});

test("ProgressBar exposes read-only public state", () => {
  const sourcePostfix = { nested: { value: 1 } };
  const output = { metadata: { mutable: true }, write() {} };
  const bar = create({ total: 2, renderer: "silent", output, postfix: sourcePostfix });

  assert.throws(() => {
    bar.current = 10;
  }, TypeError);

  const options = bar.options;
  assert.equal("output" in options, false);
  assert.equal("signal" in options, false);
  assert.equal("onRender" in options, false);
  assert.equal(Object.isFrozen(options), true);
  assert.equal(Object.isFrozen(options.postfix.nested), true);
  sourcePostfix.nested.value = 2;
  assert.equal(options.postfix.nested.value, 1);
  assert.throws(() => {
    options.postfix.nested.value = 3;
  }, TypeError);
  assert.equal(bar.snapshot().mode, "determinate");
  assert.equal(bar.snapshot().postfix.nested.value, 1);

  bar.close();
});

test("duration fields are zero padded", () => {
  const lines = [];
  const bar = create({
    label: "demo",
    total: 2,
    renderer: "memory",
    onRender(line) {
      lines.push(line);
    },
  });

  bar.increment();
  bar.increment();
  bar.succeed("done");

  assert.ok(lines.some((line) => line.includes("00:00")));
  assert.equal(
    lines.some((line) => line.includes(" 0: 0")),
    false,
  );
});
