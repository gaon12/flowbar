# API: flowbar.task(label, handler, options)

`flowbar.task()`는 여러 단계로 이루어진 작업을 하나의 task 흐름으로 표현합니다. 준비 단계는 root bar로 보여 주고, `task.progress()`를 사용하면 하위 progress 단계로 자연스럽게 전환합니다.

## Basic Usage

```js
import flowbar from "flowbar";

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

Root bar를 중간 최종 줄 없이 닫고, `flowbar.each()` 기반의 하위 progress를 시작합니다. 이 전환은 최종 종료가 아니라 단계 전환이므로 `closed after ...` 줄을 남기지 않습니다.

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
await flowbar.task("release", async (task) => {
  await task.step("test", async () => {
    throw new Error("tests failed");
  });
});
```

