# Quickstart

Use this file for the shortest working examples. Use `docs/index.md` to route to API-specific docs.

## 설치

```sh
npm install flowbar
```

## 가장 작은 예제

```js
import flowbar from "flowbar";

for (const item of flowbar([1, 2, 3], { label: "items" })) {
  await processItem(item);
}
```

## 비동기 작업

```js
await flowbar.each(urls, async (url) => {
  await fetch(url);
}, {
  label: "fetch",
  concurrency: 8,
});
```

## 남은 시간을 모르는 작업

```js
const wait = flowbar.wait({
  label: "server",
  status: "starting",
  animation: "marquee",
});

await startServer();
wait.succeed("ready");
```

## 직접 검증

```sh
npm run typecheck
npm run build
npm test
npm pack --dry-run
```
