import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import flowbar, { ProgressBar } from "../dist/index.js";

test("manual progress bar exposes elapsed, remaining, and rate", async () => {
  const lines = [];
  const bar = flowbar.create({
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
  const result = await flowbar.map(
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
  const bar = flowbar.wait({ renderer: "memory", animation: "marquee" });
  assert.equal(bar.snapshot().mode, "indeterminate");

  bar.setTotal(2);
  assert.equal(bar.snapshot().mode, "determinate");

  bar.increment();
  bar.increment();
  assert.equal(bar.snapshot().current, 2);

  bar.succeed();
});

test("stream mode increments by byte length", async () => {
  const progress = flowbar.stream({ total: 6, unit: "byte", renderer: "silent" });
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

test("named ProgressBar export is available", () => {
  const bar = new ProgressBar({ renderer: "silent" });
  assert.equal(typeof bar.increment, "function");
  bar.close();
});

test("ProgressBar exposes read-only public state", () => {
  const bar = flowbar.create({ total: 2, renderer: "silent" });

  assert.throws(() => {
    bar.current = 10;
  }, TypeError);

  const options = bar.options;
  options.mode = "indeterminate";
  assert.equal(bar.snapshot().mode, "determinate");

  bar.close();
});

test("duration fields are zero padded", () => {
  const lines = [];
  const bar = flowbar.create({
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
  assert.equal(lines.some((line) => line.includes(" 0: 0")), false);
});

test("terminal renderer throttles tight update loops", () => {
  let writes = 0;
  const output = {
    isTTY: true,
    columns: 80,
    write() {
      writes += 1;
    },
    on() {},
    off() {},
  };
  const bar = flowbar.create({ total: 1000, output, renderer: "terminal", interval: 80 });

  for (let index = 0; index < 1000; index += 1) {
    bar.increment();
  }
  bar.succeed();

  assert.ok(writes < 100, `expected throttled writes, saw ${writes}`);
});

test("ASCII charset uses ASCII final markers", () => {
  const lines = [];
  const bar = flowbar.create({
    label: "ascii",
    total: 1,
    charset: "ascii",
    renderer: "memory",
    onRender(line) {
      lines.push(line);
    },
  });

  bar.increment();
  bar.succeed();

  assert.match(lines.at(-1), /^\[OK\]/);
  assert.equal(/[✔✖■]/.test(lines.at(-1)), false);
});

test("color option emits ANSI styling when enabled", () => {
  const lines = [];
  const bar = flowbar.create({
    label: "color",
    total: 1,
    color: true,
    renderer: "memory",
    onRender(line) {
      lines.push(line);
    },
  });

  bar.succeed();

  assert.match(lines.at(-1), /\u001B\[32m/);
});

test("group.close closes tracked child bars", () => {
  const group = flowbar.group({ renderer: "silent" });
  const first = group.create({ total: 2 });
  const second = group.wait({ label: "wait" });

  group.close();

  assert.equal(first.closed, true);
  assert.equal(second.closed, true);
});

test("setTotal rejects NaN and preserves the previous total", () => {
  const bar = flowbar.create({ total: 2, renderer: "silent" });

  assert.throws(() => bar.setTotal(Number.NaN), /total must be a finite number/);
  assert.equal(bar.snapshot().total, 2);

  bar.close();
});

test("map closes async iterators when a mapper fails", async () => {
  let cleanedUp = false;
  async function* source() {
    try {
      yield 1;
      yield 2;
    } finally {
      cleanedUp = true;
    }
  }

  await assert.rejects(
    () => flowbar.map(
      source(),
      async (value) => {
        if (value === 1) {
          throw new Error("boom");
        }
        return value;
      },
      { renderer: "silent" },
    ),
    /boom/,
  );

  assert.equal(cleanedUp, true);
});

test("each does not expose a result array and validates concurrency", async () => {
  const seen = [];
  const result = await flowbar.each([1, 2, 3], async (value) => {
    seen.push(value);
  }, { renderer: "silent", concurrency: 2 });

  assert.equal(result, undefined);
  assert.deepEqual(seen.sort(), [1, 2, 3]);
  await assert.rejects(
    () => flowbar.each([1], async () => {}, { renderer: "silent", concurrency: Number.NaN }),
    /concurrency must be a finite number/,
  );
});
