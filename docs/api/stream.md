# API: flowbar.stream(options)

`flowbar.stream(options)`는 Node.js `Transform` stream을 반환합니다. byte progress에 적합합니다.

## When to Use

- `pipeline()` 중간에 progress transform을 넣고 싶을 때
- file copy, download, upload, archive 처리처럼 chunk length가 진행량일 때
- stream data 자체는 그대로 통과시키고 progress만 추적하고 싶을 때

```js
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import flowbar from "flowbar";

const progress = flowbar.stream({
    label: "copy",
    total: statSync("input.bin").size,
    unit: "byte",
  });
await progress.track(pipeline(
  createReadStream("input.bin"),
  progress,
  createWriteStream("output.bin"),
));
```

## byte mode

`unit: "byte"`이면 chunk length를 기준으로 진행률을 증가시키고, KiB, MiB, GiB 단위로 표시합니다.
`unit`을 `"byte"`가 아닌 값으로 지정하면 chunk 하나당 1씩 증가합니다.

## flowbar 접근

반환된 transform에는 내부 progress bar가 `flowbar` 속성으로 붙어 있습니다.

```js
const progress = flowbar.stream({ total: 100, unit: "byte" });
progress.flowbar.setStatus("copying");
```

## Completion and Error

- `progress.track(pipeline(...))`을 즉시 호출하면 전체 pipeline의 완료/실패를 추적합니다. 목적지의 마지막 쓰기가 끝나야 success 상태가 됩니다.
- 추적하지 않은 stream은 close 시 closed 상태로 끝납니다. Transform만으로 목적지 저장 성공을 판단하지 않습니다.
- 직접 완료를 처리하려면 `completion: "manual"`을 지정하고 pipeline 이후 `progress.flowbar.succeed()` 또는 `fail(error)`를 호출합니다.
- `signal`은 실제 Transform도 취소합니다.
- stream error가 발생하면 bar는 failure 상태로 종료됩니다.
- stream이 success/failure 없이 닫히면 bar는 closed 상태로 종료됩니다.
