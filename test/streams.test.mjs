import assert from "node:assert/strict";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import flowbar from "../dist/index.js";

function capture(options = {}) {
  const events = [];
  const progress = flowbar.stream({
    renderer: "json",
    output: { write: (s) => events.push(JSON.parse(s)) },
    ...options,
  });
  return { progress, events };
}

test("untracked transform never claims success after delayed sink failure", async () => {
  const { progress, events } = capture();
  await assert.rejects(
    pipeline(
      Readable.from([Buffer.from("abc")]),
      progress,
      new Writable({
        write(_c, _e, cb) {
          setTimeout(() => cb(Error("disk failed")), 10);
        },
      }),
    ),
    /disk failed/,
  );
  assert.equal(
    events.some((e) => e.state === "success"),
    false,
  );
});

test("track waits for destination final callback and emits one success", async () => {
  const { progress, events } = capture();
  let saved = false;
  const sink = new Writable({
    write(_c, _e, cb) {
      cb();
    },
    final(cb) {
      setTimeout(() => {
        saved = true;
        cb();
      }, 30);
    },
  });
  const work = progress.track(pipeline(Readable.from([Buffer.from("abc")]), progress, sink));
  await delay(5);
  assert.equal(
    events.some((e) => e.type === "final"),
    false,
  );
  await work;
  assert.equal(saved, true);
  assert.deepEqual(
    events.filter((e) => e.type === "final").map((e) => e.state),
    ["success"],
  );
  assert.equal(progress.flowbar.current, 3);
});

for (const failure of ["source", "middle", "sink", "final"]) {
  test(`tracked pipeline reports ${failure} failure without success`, async () => {
    const { progress, events } = capture();
    const source = Readable.from(
      (async function* () {
        yield Buffer.from("abc");
        if (failure === "source") throw Error("broken source");
      })(),
    );
    const middle = new Transform({
      transform(c, _e, cb) {
        cb(failure === "middle" ? Error("broken middle") : null, c);
      },
    });
    const sink = new Writable({
      write(_c, _e, cb) {
        setTimeout(() => cb(failure === "sink" ? Error("broken sink") : null), 5);
      },
      final(cb) {
        cb(failure === "final" ? Error("broken final") : null);
      },
    });
    await assert.rejects(progress.track(pipeline(source, progress, middle, sink)), /broken/);
    assert.deepEqual(
      events.filter((e) => e.type === "final").map((e) => e.state),
      ["failure"],
    );
  });
}

test("stream AbortSignal cancels actual pipeline work", async () => {
  const controller = new AbortController();
  const { progress, events } = capture({ signal: controller.signal });
  const source = new Readable({
    read() {
      this.push(Buffer.alloc(1024));
    },
  });
  const sink = new Writable({
    write(_c, _e, cb) {
      setTimeout(cb, 5);
    },
  });
  const work = progress.track(pipeline(source, progress, sink));
  controller.abort();
  await assert.rejects(work, { name: "AbortError" });
  assert.equal(source.destroyed, true);
  assert.equal(sink.destroyed, true);
  assert.equal(events.at(-1).state, "cancelled");
});

test("manual completion survives drainage and counts bytes under backpressure", async () => {
  const progress = flowbar.stream({ completion: "manual", renderer: "silent" });
  let received = 0;
  await pipeline(
    Readable.from(Array.from({ length: 100 }, () => Buffer.alloc(4096))),
    progress,
    new Writable({
      highWaterMark: 1,
      write(c, _e, cb) {
        received += c.length;
        setImmediate(cb);
      },
    }),
  );
  assert.equal(progress.flowbar.current, received);
  assert.equal(received, 409600);
  assert.equal(progress.flowbar.closed, false);
  progress.flowbar.succeed();
});
