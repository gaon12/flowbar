import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import flowbar, { ProgressBar } from "../dist/index.js";

test("configured APIs retain public methods and constructor through nested defaults", async () => {
  const configured = flowbar
    .configure({ renderer: "silent", label: "default" })
    .configure({ total: 3 });
  assert.equal(configured.ProgressBar, ProgressBar);
  for (const key of Object.keys(flowbar))
    assert.equal(typeof configured[key], typeof flowbar[key], key);
  const bar = configured.create();
  assert.equal(bar.label, "default");
  assert.equal(bar.total, 3);
  bar.close();
  assert.deepEqual(await configured.map([1, 2], (x) => x * 2), [2, 4]);
});

test("JSON excludes runtime objects and supports BigInt, circular postfix and shared references", () => {
  const lines = [];
  const output = { write: (s) => lines.push(JSON.parse(s)) };
  output.self = output;
  output.toJSON = () => {
    throw Error("must not serialize output");
  };
  const shared = { count: 42n };
  shared.self = shared;
  const bar = flowbar.create({
    total: 2,
    renderer: "json",
    output,
    postfix: { a: shared, b: shared },
  });
  bar.succeed();
  for (const event of lines) {
    assert.equal(event.snapshot.options.output, undefined);
    assert.equal(event.snapshot.options.onRender, undefined);
    assert.equal(event.snapshot.postfix.a.count, "42");
    assert.equal(event.snapshot.postfix.a.self, "[Circular]");
    assert.deepEqual(event.snapshot.postfix.a, event.snapshot.postfix.b);
  }
});

test("unused iterables allocate no renderer and early break closes the source", () => {
  let renders = 0;
  flowbar([], { renderer: "memory", onRender: () => renders++ });
  assert.equal(renders, 0);
  let cleaned = false;
  function* source() {
    try {
      yield 1;
      yield 2;
    } finally {
      cleaned = true;
    }
  }
  for (const _ of flowbar(source(), { renderer: "silent" })) break;
  assert.equal(cleaned, true);
});

test("failure waits for active workers, stops scheduling and preserves original cleanup error", async () => {
  const original = Error("work failed");
  const events = [];
  let index = 0;
  const source = {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      return { done: false, value: index++ };
    },
    return() {
      events.push("cleanup");
      throw Error("cleanup failed");
    },
  };
  await assert.rejects(
    flowbar.map(
      source,
      async (value) => {
        if (value === 0) {
          await delay(10);
          throw original;
        }
        await delay(30);
        events.push("worker done");
      },
      { concurrency: 2, renderer: "silent" },
    ),
    (error) => error === original,
  );
  assert.equal(index, 2);
  assert.deepEqual(events, ["worker done", "cleanup"]);
});

test("abort during final handler rejects instead of returning successful results", async () => {
  const controller = new AbortController();
  await assert.rejects(
    flowbar.map(
      [1],
      () => {
        controller.abort();
        return 1;
      },
      { signal: controller.signal, renderer: "silent" },
    ),
    { name: "AbortError" },
  );
  let called = false;
  await assert.rejects(
    flowbar.each(
      [],
      () => {
        called = true;
      },
      { signal: controller.signal, renderer: "silent" },
    ),
    { name: "AbortError" },
  );
  assert.equal(called, false);
});

test("async iterator next calls are serialized and never repeated after done", async () => {
  let active = 0;
  let next = 0;
  let done = false;
  const source = {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      assert.equal(done, false);
      assert.equal(active++, 0);
      await delay(1);
      active--;
      done = next === 3;
      return { done, value: next++ };
    },
  };
  assert.deepEqual(
    await flowbar.map(source, (x) => x, { concurrency: 8, renderer: "silent" }),
    [0, 1, 2],
  );
});

test("late close listeners get actual state and closed elapsed time stops advancing", async () => {
  const bar = flowbar.create({ renderer: "silent" });
  bar.fail("broken");
  let result;
  bar.onClose((_bar, state, message) => {
    result = [state, message];
  });
  assert.deepEqual(result, ["failure", "broken"]);
  const elapsed = bar.snapshot().timing.elapsedMs;
  await delay(10);
  assert.equal(bar.snapshot().timing.elapsedMs, elapsed);
});

test("throwing callbacks do not leak terminal resize listeners or suppress other close listeners", () => {
  const output = new EventEmitter();
  output.isTTY = true;
  output.columns = 80;
  output.write = () => {};
  assert.throws(
    () =>
      flowbar.create({
        output,
        renderer: "terminal",
        onRender() {
          throw Error("render");
        },
      }),
    /render/,
  );
  assert.equal(output.listenerCount("resize"), 0);
  const bar = flowbar.create({ output, renderer: "terminal" });
  let second = false;
  bar
    .onClose(() => {
      throw Error("listener");
    })
    .onClose(() => {
      second = true;
    });
  assert.throws(() => bar.close(), /listener/);
  assert.equal(second, true);
  assert.equal(output.listenerCount("resize"), 0);
});
