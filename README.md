# flowbar

flowbar is a progress toolkit for modern Node.js workflows. If Python has `tqdm`, flowbar aims to be the small Node.js toolkit you reach for when loops, async iterables, concurrent tasks, streams, or unknown-duration work need progress.

## Remember this first

```js
import { pipeline } from "node:stream/promises";
import flowbar from "flowbar";

for (const file of flowbar(files, { label: "files" })) {
  await upload(file);
}

for await (const row of flowbar(readRows(), { label: "rows" })) {
  await save(row);
}

await flowbar.each(urls, async (url) => {
  await fetch(url);
}, { label: "fetch", concurrency: 8 });

await pipeline(
  input,
  flowbar.stream({ label: "copy", total: size, unit: "byte" }),
  output,
);

const wait = flowbar.wait({ label: "connect", status: "waiting" });
await connect();
wait.succeed("connected");
```

The idea scales without changing tools: wrap an iterable, consume an async iterable, run bounded concurrency, track a byte stream, or show a wait state with one progress API.

Node.js의 async iterable, promise concurrency, stream, indeterminate task까지 자연스럽게 다루는 zero-dependency progress toolkit입니다.

`flowbar`의 목표는 progress bar 객체를 복잡하게 조작하게 만드는 것이 아니라, 작업을 감싸면 진행 상태가 자연스럽게 드러나도록 하는 것입니다.

## 빠른 선택

- iterable을 감싸려면 `flowbar(input, options)`
- 결과 배열이 필요하면 `flowbar.map(input, mapper, options)`
- 결과 배열이 필요 없으면 `flowbar.each(input, handler, options)`
- 수동으로 값과 상태를 제어하려면 `flowbar.create(options)`
- total을 모르는 대기 작업은 `flowbar.wait(options)`
- Node.js byte stream은 `flowbar.stream(options)`

## 특징

- `for ... of`, `for await ... of`에서 바로 사용
- `elapsed`, `remaining`, `rate` 기본 표시
- 전체 수량이 없는 counting mode 지원
- 남은 시간을 알 수 없는 indeterminate mode 지원
- spinner, marquee, bounce, pulse 애니메이션 지원
- 터미널 창 크기 변경에 자동 대응
- 같은 줄 또는 같은 live region에서 갱신
- `console.log`와 섞일 때를 위한 safe logging API 제공
- Node.js stream byte progress 지원
- TypeScript declaration 내장
- runtime dependency 없음
- native addon, postinstall script 없음
- CI, pipe, non-TTY 환경에서는 plain log로 자동 전환
- LLM 친화 문서 제공: `llms.txt`, `llms-full.txt`, `docs/`
- strict TypeScript source에서 `dist`와 declaration 생성

## 설치

```sh
npm install flowbar
```

현재 저장소를 직접 검증하려면 다음 명령을 사용합니다.

```sh
npm run typecheck
npm run lint
npm run build
npm test
node --check dist/index.js
npm pack --dry-run
```

## 기본 사용법

```js
import flowbar from "flowbar";

const files = ["a.txt", "b.txt", "c.txt"];

for (const file of flowbar(files, { label: "files" })) {
  await upload(file);
}
```

## AsyncIterable

```js
import flowbar from "flowbar";

async function* createJobs() {
  yield "job-a";
  yield "job-b";
  yield "job-c";
}

for await (const job of flowbar(createJobs(), { label: "jobs", total: 3 })) {
  await runJob(job);
}
```

## Concurrency map

```js
import flowbar from "flowbar";

const results = await flowbar.map(
  files,
  async (file) => {
    return upload(file);
  },
  {
    label: "upload",
    concurrency: 8,
  },
);
```

결과 배열이 필요 없으면 `each`를 사용합니다.

```js
await flowbar.each(files, async (file) => {
  await upload(file);
}, {
  label: "upload",
  concurrency: 8,
});
```

## 수동 제어

```js
import flowbar from "flowbar";

const bar = flowbar.create({ label: "manual", total: 100 });

bar.increment(10);
bar.setPostfix({ phase: "download" });
bar.increment(20);
bar.succeed("complete");
```

## Indeterminate mode

남은 시간을 알 수 없을 때는 fake ETA를 표시하지 않습니다. 대신 상태, elapsed, 애니메이션을 보여 줍니다.

```js
import flowbar from "flowbar";

const wait = flowbar.wait({
  label: "connect",
  status: "waiting",
  animation: "marquee",
});

await connectToServer();

wait.succeed("connected");
```

## Stream byte progress

```js
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import flowbar from "flowbar";

const input = "input.bin";
const output = "output.bin";

await pipeline(
  createReadStream(input),
  flowbar.stream({
    label: "copy",
    total: statSync(input).size,
    unit: "byte",
  }),
  createWriteStream(output),
);
```

## Safe logging

```js
import flowbar from "flowbar";

const bar = flowbar.create({ label: "build", total: 3 });

bar.log("build started");
bar.increment();
bar.warn("slow test detected");
bar.increment();
bar.increment();
bar.succeed("done");
```

## Terminal rendering contract

`flowbar`는 TTY 환경에서 다음 동작을 기본으로 합니다.

- progress line을 터미널 폭보다 길게 출력하지 않습니다.
- 빠른 loop에서 `interval` 기준으로 렌더링을 throttle합니다.
- 터미널 창 크기가 바뀌면 자동으로 레이아웃을 다시 계산합니다.
- 업데이트마다 새 줄을 만들지 않고 같은 줄 또는 같은 live region을 갱신합니다.
- 완료, 실패, 취소 시에만 최종 줄을 남깁니다.
- `charset: "ascii"`에서는 최종 상태 marker도 ASCII로 출력합니다.
- `color: true`를 주면 최종 상태 marker에 ANSI 색상을 적용합니다.
- safe logging을 사용할 때는 live region을 보존하면서 로그를 출력합니다.
- non-TTY, CI, pipe 환경에서는 ANSI 제어 문자를 남기지 않는 plain renderer로 전환합니다.

## Runtime contract

- `total`, `current`, `update(value)`, `setTotal(total)`, `increment(delta)`, `concurrency`는 finite number여야 합니다.
- `total`, `current`, `setTotal(total)`은 음수를 허용하지 않습니다.
- `setMode(mode)`는 `"auto"`, `"determinate"`, `"counting"`, `"indeterminate"`만 허용합니다.
- `ProgressBar`의 공개 상태 필드는 getter로 노출되며 직접 대입으로 변경하지 않습니다. 상태 변경은 `increment`, `update`, `setTotal`, `setStatus`, `setPostfix`를 사용합니다.
- `map`/`each` 처리 중 mapper 또는 handler가 실패하면 bar는 failure 상태가 되고 async iterator cleanup을 위해 `return()`을 호출합니다.
- `each`는 대량 작업에서 불필요한 결과 배열을 만들지 않습니다.

## 문서

LLM과 사람이 빠르게 읽기 위한 문서는 다음 순서로 보면 됩니다.

- `docs/index.md`
- `docs/llm-guide.md`
- `docs/quickstart.md`
- `docs/api/flowbar.md`
- `docs/api/create.md`
- `docs/api/map.md`
- `docs/api/stream.md`
- `docs/api/wait.md`
- `docs/api/group.md`
- `docs/api/types.md`
- `docs/terminal-behavior.md`
- `docs/terminal-reliability.md`
- `docs/recipes.md`
- `docs/comparison.md`

전체 문서는 `docs/full.md`에 있습니다.
LLM용 요약 색인은 `llms.txt`, 전체 LLM 문서는 `llms-full.txt`에 있습니다.

## 라이선스

MIT
