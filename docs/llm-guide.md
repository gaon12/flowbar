# LLM Guide

이 문서는 LLM이 `flowbar` 코드를 생성할 때 우선 참고해야 할 짧은 가이드입니다.

## Routing

- iterable wrapper: `docs/api/flowbar.md`
- manual bar: `docs/api/create.md`
- concurrency: `docs/api/map.md`
- stream: `docs/api/stream.md`
- indeterminate: `docs/api/wait.md`
- multi-step task: `docs/api/task.md`
- TypeScript/options: `docs/api/types.md`
- terminal behavior: `docs/terminal-behavior.md`
- recipes: `docs/recipes.md`
- comparison/positioning: `docs/comparison.md`
- terminal reliability: `docs/terminal-reliability.md`

## 기본 import

```js
import flowbar from "flowbar";
```

## iterable

```js
for (const item of flowbar(items, { label: "items" })) {
  await processItem(item);
}
```

## async iterable

```js
for await (const item of flowbar(asyncItems, { label: "items", total })) {
  await processItem(item);
}
```

## concurrency

```js
await flowbar.map(items, async (item) => {
  return processItem(item);
}, {
  label: "items",
  concurrency: 8,
});
```

Use `each` when no result array is needed:

```js
await flowbar.each(items, async (item) => {
  await processItem(item);
}, {
  label: "items",
  concurrency: 8,
});
```

## manual

```js
const bar = flowbar.create({ label: "job", total: 100 });
bar.increment(10);
bar.succeed("done");
```

## wait / indeterminate

```js
const wait = flowbar.wait({ label: "server", animation: "marquee" });
await startServer();
wait.succeed("ready");
```

## stream

```js
await pipeline(
  createReadStream(input),
  flowbar.stream({ label: "copy", total: size, unit: "byte" }),
  createWriteStream(output),
);
```

## task

```js
await flowbar.task("deploy", async (task) => {
  await task.step("prepare", async () => prepare());
  await task.progress("upload", files, async (file) => upload(file), {
    concurrency: 4,
  });
});
```

## 피해야 할 패턴

- indeterminate mode에서 remaining 또는 percent를 임의로 표시하지 않습니다.
- CLI의 실제 결과 출력과 progress 출력이 섞이지 않도록 기본 출력은 stderr를 사용합니다.
- 터미널 렌더링 중에는 직접 `console.log`보다 `bar.log`를 우선 사용합니다.
- 결과가 필요 없는 대량 작업에 `map`을 쓰지 않습니다. `each`를 사용합니다.
- `NaN`, `Infinity`, 0 미만 total, 1 미만 concurrency를 넣지 않습니다.
- mapper 실패 시 upstream cleanup이 필요하면 async iterator에 `return()`을 구현합니다.

## Runtime Contract

- `flowbar.map` returns ordered results.
- `flowbar.each` returns `undefined`.
- TTY rendering is throttled by `interval`.
- Failed mapper/handler closes the bar and calls async iterator `return()` when available.
- `renderer: "silent"` is preferred in tests.
