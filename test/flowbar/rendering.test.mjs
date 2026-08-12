import assert from "node:assert/strict";
import test from "node:test";
import { displayWidth } from "../../dist/core/utils.js";
import { create, wait } from "../../dist/index.js";

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

test("JSON renderer throttles updates and serializes data-only snapshots", () => {
  const chunks = [];
  const output = {
    write(chunk) {
      chunks.push(String(chunk));
    },
  };
  output.self = output;
  const circularPostfix = { count: 1 };
  circularPostfix.self = circularPostfix;
  const bar = create({ total: 1000, output, postfix: circularPostfix, renderer: "json", interval: 80 });

  for (let index = 0; index < 1000; index += 1) {
    bar.increment();
  }
  bar.succeed();

  assert.ok(chunks.length < 100, `expected throttled JSON writes, saw ${chunks.length}`);
  const events = chunks.map((chunk) => JSON.parse(chunk));
  assert.equal(events[0].type, "progress");
  assert.equal(events.at(-1).type, "final");
  assert.equal("output" in events.at(-1).snapshot.options, false);
  assert.equal(events.at(-1).snapshot.postfix.self, "[Circular]");
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

test("determinate layout stays full width across count and postfix changes", () => {
  const lines = [];
  const bar = create({
    label: "stable",
    total: 100,
    current: 9,
    charset: "ascii",
    renderer: "memory",
    output: { columns: 80, write() {} },
    onRender(line) {
      if (line.includes("|") && !line.startsWith("[OK]")) lines.push(line);
    },
  });

  bar.update(10);
  bar.setPostfix({ phase: "a-very-long-phase-name-that-should-be-truncated" });
  bar.update(99);
  bar.succeed();

  assert.ok(lines.length >= 3);
  assert.deepEqual(new Set(lines.map(displayWidth)), new Set([80]));
  assert.equal(
    lines.some((line) => line.includes("…")),
    false,
  );
});

test("tqdm layout uses the full terminal width and preserves ETA before optional metadata", () => {
  const lines = [];
  const bar = create({
    label: "eta",
    total: 100,
    charset: "ascii",
    renderer: "memory",
    output: { columns: 80, write() {} },
    onRender(line) {
      if (line.includes("|")) lines.push(line);
    },
  });

  bar.increment();
  bar.setPostfix({ phase: "a-postfix-that-does-not-fit-next-to-the-full-tqdm-metadata" });

  assert.equal(displayWidth(lines.at(-1)), 80);
  assert.match(lines.at(-1), /\[00:00<00:00/);
  assert.equal(lines.at(-1).includes("…"), false);
  bar.close();
});

test("terminal width uses every reported column unless a wrap guard is requested", () => {
  const lines = [];
  const output = { columns: 60, write() {} };
  const full = create({
    total: 10,
    charset: "ascii",
    renderer: "memory",
    output,
    onRender: (line) => lines.push(line),
  });
  const guarded = create({
    total: 10,
    charset: "ascii",
    renderer: "memory",
    output,
    wrapGuardColumns: 2,
    onRender: (line) => lines.push(line),
  });

  assert.equal(displayWidth(lines[0]), 60);
  assert.equal(displayWidth(lines[1]), 58);
  full.close();
  guarded.close();
});

test("determinate bars use a blank tqdm-style track by default", () => {
  const lines = [];
  const bar = create({
    total: 10,
    charset: "ascii",
    renderer: "memory",
    output: { columns: 60, write() {} },
    onRender: (line) => lines.push(line),
  });

  const track = lines[0].match(/\|([^|]*)\|/)?.[1];
  assert.ok(track.length >= 6);
  assert.match(track, /^ +$/);
  bar.close();
});

test("shaded tracks preserve the previous visible empty-cell style", () => {
  const lines = [];
  const bar = create({
    total: 10,
    barTrack: "shaded",
    charset: "ascii",
    renderer: "memory",
    output: { columns: 60, write() {} },
    onRender: (line) => lines.push(line),
  });

  const track = lines[0].match(/\|([^|]*)\|/)?.[1];
  assert.match(track, /^-+$/);
  assert.equal(bar.options.barTrack, "shaded");
  bar.close();
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
    onRender: (line) => lines.push(line),
  });
  bar.increment();
  bar.succeed();
  assert.match(lines.at(-1), /^\[OK\]/);
  assert.equal(/[✔✖■]/.test(lines.at(-1)), false);
});
