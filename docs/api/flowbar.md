# API: flowbar(input, options)

`flowbar(input, options)`는 `Iterable` 또는 `AsyncIterable`을 progress-aware iterable로 감쌉니다.

## When to Use

- 기존 `for ... of` 또는 `for await ... of` 구조를 유지하고 싶을 때
- 각 항목의 작업이 반복문 본문 안에 있을 때
- 결과 배열, concurrency helper, stream transform이 필요 없을 때

## 동기 iterable

```js
import flowbar from "flowbar";

for (const item of flowbar([1, 2, 3], { label: "items" })) {
  await processItem(item);
}
```

반복문 본문이 끝난 뒤 다음 항목으로 넘어갈 때 progress가 증가합니다. 따라서 실제 작업이 끝난 시점을 기준으로 진행률이 반영됩니다.

## 비동기 iterable

```js
import flowbar from "flowbar";

async function* jobs() {
  yield "a";
  yield "b";
  yield "c";
}

for await (const job of flowbar(jobs(), { label: "jobs", total: 3 })) {
  await runJob(job);
}
```

## total 자동 추론

배열, typed array, `Set`, `Map`처럼 `length` 또는 `size`가 있는 입력은 `total`을 자동 추론합니다.

```js
flowbar(new Set(["a", "b", "c"]));
```

generator처럼 전체 개수를 알 수 없는 입력은 counting mode로 동작합니다.

## 주요 옵션

- `label`: progress 앞 이름
- `total`: 전체 작업량
- `unit`: `"item"`, `"byte"`, 사용자 정의 문자열
- `preset`: `"tqdm"`, `"compact"`, `"verbose"`, `"minimal"`
- `renderer`: `"auto"`, `"terminal"`, `"plain"`, `"silent"`, `"json"`, `"memory"`
- `signal`: `AbortSignal`
- `interval`: TTY live rendering 최소 갱신 간격

## 취소

```js
const controller = new AbortController();

for await (const item of flowbar(items, { signal: controller.signal })) {
  await processItem(item);
}
```

`signal`이 abort되면 `AbortError`를 던지고 progress bar는 cancelled 상태로 종료됩니다.

## Error and Cleanup

반복문 본문에서 예외가 발생하면 wrapper는 bar를 failure 상태로 종료하고 예외를 다시 던집니다.
`for await` 소비가 중단되면 JavaScript async iterator protocol에 따라 upstream cleanup이 실행될 수 있습니다.
