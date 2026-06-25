# flowbar Full Documentation

`flowbar`는 Node.js용 zero-dependency progress toolkit입니다. Iterable, AsyncIterable, concurrency helpers, Node.js streams, indeterminate tasks를 다룹니다.

For token-efficient reading, prefer `docs/index.md` and the API-specific files under `docs/api/`.

## Install

```sh
npm install flowbar
```

## Choose the API

- `flowbar(input, options)`: wrap `Iterable` or `AsyncIterable`.
- `flowbar.map(input, mapper, options)`: concurrent processing with ordered result array.
- `flowbar.each(input, handler, options)`: concurrent processing without result allocation.
- `flowbar.create(options)`: manual `ProgressBar`.
- `flowbar.wait(options)`: indeterminate work with no fake ETA.
- `flowbar.stream(options)`: Node.js `Transform` progress, usually byte progress.
- `flowbar.group(options)`: shared defaults for multiple bars.
- `flowbar.task(label, handler, options)`: multi-step workflows with task phases.

## Core Principles

- If `total` is known, show percent, elapsed, remaining, and rate.
- If `total` is unknown but count increases, use counting mode.
- If no useful count is known, use indeterminate mode.
- Do not invent percent or ETA for indeterminate tasks.
- Default output is `stderr`, so normal command output can stay on `stdout`.
- TTY output updates a live region and throttles fast loops by `interval`.
- CI, pipe, and non-TTY output uses plain line rendering.
- Runtime dependency count is zero.
- `charset: "ascii"` keeps progress and final markers ASCII-only.
- `color: true` enables ANSI color for final state markers.

## Basic Iterable

```js
import flowbar from "flowbar";

for (const item of flowbar(items, { label: "items" })) {
  await processItem(item);
}
```

Arrays, typed arrays, `Set`, and `Map` infer `total` from `length` or `size`. Generators without a known total use counting mode after progress starts.

## AsyncIterable

```js
for await (const item of flowbar(asyncItems, { label: "items", total: 100 })) {
  await processItem(item);
}
```

## Manual ProgressBar

```js
const bar = flowbar.create({ label: "manual", total: 100 });
bar.increment(10);
bar.update(50);
bar.setPostfix({ phase: "download" });
bar.succeed("done");
```

Runtime validation rejects non-finite numeric state such as `NaN` and `Infinity`. `setTotal(total)` requires a finite non-negative number, `null`, or `undefined`.
Public `ProgressBar` state is exposed as read-only getters. Use methods such as `increment`, `update`, `setTotal`, `setStatus`, and `setPostfix` to change state.
`close(message, { leave: false })` suppresses the final line for that close call without changing the bar's default `leave` option.

## Concurrency

```js
const results = await flowbar.map(items, async (item, index, bar) => {
  bar.setPostfix({ index });
  return processItem(item);
}, {
  label: "items",
  concurrency: 8,
});
```

`map` returns results in input order. `concurrency` must be a finite number greater than or equal to 1.

Use `each` when no result array is needed:

```js
await flowbar.each(items, async (item) => {
  await processItem(item);
}, {
  label: "items",
  concurrency: 8,
});
```

If mapper or handler fails, the bar fails and async iterator `return()` is called when available.

## Stream

```js
await pipeline(
  createReadStream(input),
  flowbar.stream({ label: "copy", total: size, unit: "byte" }),
  createWriteStream(output),
);
```

`unit: "byte"` increments by chunk length and formats byte units as B, KiB, MiB, GiB, and higher.

## Wait / Indeterminate

```js
const wait = flowbar.wait({
  label: "connect",
  status: "waiting",
  animation: "marquee",
});

await connectToServer();
wait.succeed("connected");
```

Supported animations: `spinner`, `marquee`, `bounce`, `pulse`.

If total becomes known later:

```js
const bar = flowbar.wait({ label: "scan" });
const files = await discoverFiles();
bar.setTotal(files.length);
for (const file of files) {
  await processFile(file);
  bar.increment();
}
bar.succeed();
```

## Task

```js
await flowbar.task("deploy", async (task) => {
  await task.step("prepare", async () => {
    await prepare();
  });

  await task.progress("upload", files, async (file) => {
    await upload(file);
  }, {
    concurrency: 4,
  });
});
```

`task.progress()` transitions from the root task bar to child progress without leaving an intermediate `closed after ...` final line.

## Modes

Determinate:

```text
upload  42% |████████░░░░░░░░░░░░| 420/1000 [00:12<00:17, 34.8 items/s]
```

Counting:

```text
crawl  1,248 items | elapsed 00:18 | 68.9 items/s
```

Indeterminate:

```text
connect  |░░░░██████░░░░░░░░| waiting | elapsed 00:08
```

## Terminal Behavior

`renderer: "auto"` is the default.

- TTY and non-CI: terminal renderer.
- CI, pipe, non-TTY: plain renderer.
- Fast TTY update loops are throttled by `interval`, default 80ms.
- Resize listeners are cleaned up when the last terminal renderer for an output is disposed.
- Use `bar.log`, `bar.warn`, and `bar.error` instead of `console.log` while a live region is active.
- ASCII charset uses ASCII final markers such as `[OK]`, `[ERR]`, and `[CANCEL]`.
- `color: true` adds ANSI color to final state markers.

## TypeScript

```ts
import flowbar, { ProgressBar, FlowbarOptions } from "flowbar";

const options: FlowbarOptions = {
  label: "typed",
  total: 100,
};

const bar: ProgressBar = flowbar.create(options);
bar.increment();
bar.succeed();
```

The source is strict TypeScript. `npm run build` generates `dist/index.js` and `dist/index.d.ts`.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm pack --dry-run
```

## More Docs

- `docs/index.md`
- `docs/quickstart.md`
- `docs/llm-guide.md`
- `docs/api/flowbar.md`
- `docs/api/create.md`
- `docs/api/map.md`
- `docs/api/stream.md`
- `docs/api/wait.md`
- `docs/api/group.md`
- `docs/api/task.md`
- `docs/api/types.md`
- `docs/terminal-behavior.md`
- `docs/terminal-reliability.md`
- `docs/recipes.md`
- `docs/comparison.md`

## License

MIT
