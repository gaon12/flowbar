import assert from "node:assert/strict";
import test from "node:test";
import { displayWidth, truncateDisplay } from "../../dist/core/utils.js";
import { create, each, group, map, task } from "../../dist/index.js";

test("group.close closes tracked child bars", () => {
  const bars = group({ renderer: "silent" });
  const first = bars.create({ total: 2 });
  const second = bars.wait({ label: "wait" });
  assert.equal(bars.size, 2);

  first.succeed();
  assert.equal(bars.size, 1);

  bars.close();

  assert.equal(first.closed, true);
  assert.equal(second.closed, true);
  assert.equal(bars.size, 0);
});

test("task.progress keeps the root available for later steps", async () => {
  const lines = [];
  let root;

  await task(
    "deploy",
    async (task) => {
      root = task.bar;
      await task.progress("upload", [1, 2], async () => {});
      assert.equal(task.bar.closed, false);
      await task.step("verify", async (bar) => {
        assert.equal(bar, task.bar);
        assert.equal(bar.status, "verify");
      });
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
  assert.ok(lines.some((line) => line.includes("verify")));
  assert.equal(root.closed, true);
});

test("setTotal rejects NaN and preserves the previous total", () => {
  const bar = create({ total: 2, renderer: "silent" });

  assert.throws(() => bar.setTotal(Number.NaN), /total must be a finite number/);
  assert.equal(bar.snapshot().total, 2);

  bar.close();
});

test("clearing total exits determinate mode", () => {
  const bar = create({ total: 2, renderer: "silent" });

  bar.setTotal(undefined);

  assert.equal(bar.total, undefined);
  assert.equal(bar.snapshot().mode, "indeterminate");
  bar.increment();
  assert.equal(bar.snapshot().mode, "counting");
  bar.close();
});

test("display width and truncation preserve grapheme clusters", () => {
  const family = "👨‍👩‍👧‍👦";
  assert.equal(displayWidth(`한${family}é👍🏽`), 7);
  assert.equal(truncateDisplay(`A${family}BC`, 4), `A${family}…`);
});

test("invalid renderer capabilities fail during construction", () => {
  assert.throws(() => create({ renderer: "typo" }), /renderer must be one of/);
  assert.throws(() => create({ charset: "petscii" }), /charset must be one of/);
  assert.throws(() => create({ color: "ultraviolet" }), /color must be/);
  assert.throws(() => create({ output: {} }), /output must provide a write/);
  assert.throws(() => create({ onRender: "not a callback" }), /onRender must be a function/);
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
