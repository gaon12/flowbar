import assert from "node:assert/strict";
import test from "node:test";
import flowbar from "../../dist/index.js";

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
  const bar = flowbar.create({ label: "paint", total: 2, output, renderer: "terminal" });

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
  const bar = flowbar.create({
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
    const determinate = flowbar.create({ total: 10, renderer: "memory" });
    const counting = flowbar.create({ current: 1, renderer: "memory" });
    assert.equal(started, 0);

    const wait = flowbar.wait({ renderer: "memory" });
    assert.equal(started, 1);

    wait.setTotal(2);
    assert.equal(cleared, 1);

    determinate.close();
    counting.close();
    wait.close();
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
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

  assert.ok(lines.at(-1).includes("\u001B[32m"));
});

test("group.close closes tracked child bars", () => {
  const group = flowbar.group({ renderer: "silent" });
  const first = group.create({ total: 2 });
  const second = group.wait({ label: "wait" });

  group.close();

  assert.equal(first.closed, true);
  assert.equal(second.closed, true);
});

test("task.progress transitions without leaving a root closed line", async () => {
  const lines = [];

  await flowbar.task(
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
    () =>
      flowbar.map(
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
  const result = await flowbar.each(
    [1, 2, 3],
    async (value) => {
      seen.push(value);
    },
    { renderer: "silent", concurrency: 2 },
  );

  assert.equal(result, undefined);
  assert.deepEqual(seen.sort(), [1, 2, 3]);
  await assert.rejects(
    () => flowbar.each([1], async () => {}, { renderer: "silent", concurrency: Number.NaN }),
    /concurrency must be a finite number/,
  );
});
