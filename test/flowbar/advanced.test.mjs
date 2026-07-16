import assert from "node:assert/strict";
import test from "node:test";
import { create, each, group, map, task, wait } from "../../dist/index.js";

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
  const bar = create({ total: 1000, output, renderer: "terminal", interval: 80 });

  for (let index = 0; index < 1000; index += 1) {
    bar.increment();
  }
  bar.succeed();

  assert.ok(writes < 100, `expected throttled writes, saw ${writes}`);
});

test("terminal renderer batches line repaint chunks with content", () => {
  const chunks = [];
  const output = {
    isTTY: true,
    columns: 80,
    write(chunk) {
      chunks.push(String(chunk));
    },
    on() {},
    off() {},
  };
  const bar = create({ label: "paint", total: 2, output, renderer: "terminal" });

  bar.setStatus("half");
  bar.succeed();

  assert.ok(chunks.length > 0);
  assert.equal(
    chunks.some((chunk) => chunk === "\u001B[2K"),
    false,
  );
  assert.ok(chunks.some((chunk) => chunk.includes("paint") && chunk.includes("\u001B[0K")));
});

test("determinate bar width stays stable across count and postfix changes", () => {
  const lines = [];
  const bar = create({
    label: "stable",
    total: 100,
    current: 9,
    charset: "ascii",
    renderer: "memory",
    output: { columns: 80, write() {} },
    onRender(line) {
      if (line.includes("|") && !line.startsWith("[OK]")) {
        lines.push(line);
      }
    },
  });

  bar.update(10);
  bar.setPostfix({ phase: "a-very-long-phase-name-that-should-be-truncated" });
  bar.update(99);
  bar.succeed();

  const barWidths = lines.map((line) => line.match(/\|([^|]*)\|/)?.[1]?.length).filter((width) => width != null);
  assert.ok(barWidths.length >= 3);
  assert.equal(new Set(barWidths).size, 1);
});

test("determinate bars do not start idle animation timers", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let started = 0;
  let cleared = 0;

  globalThis.setInterval = () => {
    started += 1;
    return { unref() {} };
  };
  globalThis.clearInterval = () => {
    cleared += 1;
  };

  try {
    const determinate = create({ total: 10, renderer: "memory" });
    const counting = create({ current: 1, renderer: "memory" });
    assert.equal(started, 0);

    const waiting = wait({ renderer: "memory" });
    assert.equal(started, 1);

    waiting.setTotal(2);
    assert.equal(cleared, 1);

    determinate.close();
    counting.close();
    waiting.close();
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("ASCII charset uses ASCII final markers", () => {
  const lines = [];
  const bar = create({
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
  const bar = create({
    label: "color",
    total: 1,
    color: true,
    renderer: "memory",
    onRender(line) {
      lines.push(line);
    },
  });

  bar.succeed();

  assert.ok(lines.at(-1).includes("\u001B[32m"));
});

test("group.close closes tracked child bars", () => {
  const bars = group({ renderer: "silent" });
  const first = bars.create({ total: 2 });
  const second = bars.wait({ label: "wait" });

  bars.close();

  assert.equal(first.closed, true);
  assert.equal(second.closed, true);
});

test("task.progress transitions without leaving a root closed line", async () => {
  const lines = [];

  await task(
    "deploy",
    async (task) => {
      await task.progress("upload", [1, 2], async () => {});
    },
    {
      renderer: "memory",
      onRender(line) {
        lines.push(line);
      },
    },
  );

  assert.equal(
    lines.some((line) => line.includes("closed after")),
    false,
  );
  assert.ok(lines.some((line) => line.includes("upload")));
});

test("setTotal rejects NaN and preserves the previous total", () => {
  const bar = create({ total: 2, renderer: "silent" });

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
    () =>
      map(
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
  const result = await each(
    [1, 2, 3],
    async (value) => {
      seen.push(value);
    },
    { renderer: "silent", concurrency: 2 },
  );

  assert.equal(result, undefined);
  assert.deepEqual(seen.sort(), [1, 2, 3]);
  await assert.rejects(
    () => each([1], async () => {}, { renderer: "silent", concurrency: Number.NaN }),
    /concurrency must be a finite number/,
  );
  await assert.rejects(
    () => each([1], async () => {}, { renderer: "silent", concurrency: 1.5 }),
    /concurrency must be an integer/,
  );
  await assert.rejects(
    () => each([1], async () => {}, { renderer: "silent", concurrency: 1025 }),
    /concurrency must be less than or equal to 1024/,
  );
});

test("each caps workers to a known input size", async () => {
  let nextCalls = 0;
  const input = [1, 2, 3];
  const originalIterator = input[Symbol.iterator].bind(input);
  input[Symbol.iterator] = () => {
    const iterator = originalIterator();
    return {
      next() {
        nextCalls += 1;
        return iterator.next();
      },
    };
  };

  await each(input, async () => {}, { renderer: "silent", concurrency: 100 });

  assert.ok(nextCalls <= 6, `expected at most 6 iterator reads, saw ${nextCalls}`);
});

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
