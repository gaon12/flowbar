# API: flowbar.map(input, mapper, options)

`flowbar.map`은 iterable 또는 async iterable을 concurrency 제한과 함께 처리하고, 각 항목이 완료될 때 progress를 증가시킵니다.

## When to Use

- 동시에 여러 항목을 처리해야 할 때
- mapper의 결과 배열이 필요할 때
- 입력 순서와 결과 순서를 맞춰야 할 때

```js
import flowbar from "flowbar";

const results = await flowbar.map(
  files,
  async (file, index, bar) => {
    bar.setPostfix({ file });
    return upload(file);
  },
  {
    label: "upload",
    concurrency: 8,
  },
);
```

## 반환값

`mapper`의 결과를 입력 순서대로 담은 배열을 반환합니다.
작업 완료 순서가 달라도 결과 배열은 입력 순서를 유지합니다.

## concurrency

기본값은 `1`입니다.
`concurrency`는 finite number이고 1 이상이어야 합니다.

```js
await flowbar.map(items, worker, { concurrency: 4 });
```

## flowbar.each

결과 배열이 필요 없으면 `flowbar.each`를 사용합니다.
`each`는 `undefined`를 반환하며 대량 작업에서 결과 배열을 만들지 않습니다.

```js
await flowbar.each(files, async (file) => {
  await upload(file);
}, { concurrency: 8 });
```

## AbortSignal

```js
const controller = new AbortController();

await flowbar.map(items, worker, {
  concurrency: 8,
  signal: controller.signal,
});
```

## Error and Cleanup

- mapper 또는 handler가 실패하면 bar는 failure 상태로 종료되고 원래 error를 다시 던집니다.
- async iterator 입력에 `return()`이 있으면 실패 시 호출합니다.
- 이미 실행 중인 concurrent mapper는 JavaScript promise semantics상 강제 중단하지 않습니다. 취소가 필요하면 `AbortSignal`을 mapper 내부 작업에도 전달합니다.
