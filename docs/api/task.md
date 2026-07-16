# API: task(label, handler, options)

`task()` named export는 여러 단계로 이루어진 작업을 하나의 task 흐름으로 표현합니다. root bar는 전체 task가 끝날 때까지 살아 있습니다.

## Basic Usage

```js
import { task } from "flowbar";

await task("deploy", async (task) => {
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

## Task API

### task.step(label, handler)

Root bar의 status를 바꾸고 handler를 실행합니다.

```js
await task.step("build", async (bar) => {
  await build();
  bar.setPostfix({ target: "dist" });
});
```

### task.indeterminate(label, handler)

Root bar를 indeterminate mode로 바꾸고 handler를 실행합니다. 완료 시점을 모르는 단계에 사용합니다.

```js
await task.indeterminate("connect", async () => {
  await connect();
});
```

### task.progress(label, items, handler, options)

Root bar의 status를 단계 label로 바꾸고 `each()` 기반의 child progress를 시작합니다. child가 끝난 뒤 root는 열린 상태이므로 다음 `task.step()` 또는 `task.indeterminate()`가 정상 동작합니다.

```js
await task.progress("migrate", rows, async (row) => {
  await migrate(row);
}, {
  concurrency: 2,
});
```

## Failure Behavior

handler가 실패하면 활성 bar가 failure 상태로 종료되고 error가 다시 throw됩니다.

```js
await task("release", async (task) => {
  await task.step("test", async () => {
    throw new Error("tests failed");
  });
});
```
