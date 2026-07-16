# API: stream(options)

`stream(options)` named export는 Node.js `Transform` stream을 반환합니다. byte progress와 object-mode item progress를 분리해 지원합니다.

## When to Use

- `pipeline()` 중간에 progress transform을 넣고 싶을 때
- file copy, download, upload, archive 처리처럼 encoded byte length가 진행량일 때
- stream data 자체는 그대로 통과시키고 progress만 추적하고 싶을 때

```js
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { stream } from "flowbar";

await pipeline(
  createReadStream("input.bin"),
  stream({
    label: "copy",
    total: statSync("input.bin").size,
    unit: "byte",
  }),
  createWriteStream("output.bin"),
);
```

## byte mode

`unit: "byte"`이면 Buffer/typed array는 byte length로, 문자열은 실제 stream encoding을 사용한 `Buffer.byteLength()`로 계산합니다.
`unit`을 `"byte"`가 아닌 값으로 지정하면 chunk 하나당 1씩 증가합니다.
`objectMode: true`의 기본 unit은 `"item"`입니다. object chunk를 `unit: "byte"`와 함께 쓰면 명시적으로 실패합니다.

## flowbar 접근

반환된 transform에는 내부 progress bar가 `flowbar` 속성으로 붙어 있습니다.

```js
const progress = stream({ total: 100, unit: "byte" });
progress.flowbar.setStatus("copying");
```

## Completion and Error

- stream flush 시 bar는 success 상태로 종료됩니다.
- stream error가 발생하면 bar는 failure 상태로 종료됩니다.
- stream이 success/failure 없이 닫히면 bar는 closed 상태로 종료됩니다.
