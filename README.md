# flowbar

`flowbar`는 Node.js에서 쓰는 zero-dependency progress toolkit입니다.

목표는 Python의 `tqdm`처럼 단순한 사용감입니다. 작업을 감싸기만 하면 진행률, 경과 시간, 남은 시간, 처리 속도가 자연스럽게 보이도록 만드는 것이 핵심입니다.

## 설치

```sh
npm install flowbar
```

## 가장 기본 사용법

이미 배열이나 iterable이 있다면 `flowbar(items)`로 감싸면 됩니다.

```js
import flowbar from "flowbar";

const files = ["a.txt", "b.txt", "c.txt"];

for (const file of flowbar(files, { label: "files" })) {
  // 실제 작업은 여기에서 합니다.
  await upload(file);
}
```

직접 `for`문을 쓰고 싶지 않다면 `flowbar.each()`를 쓰면 됩니다.

```js
import flowbar from "flowbar";

const files = ["a.txt", "b.txt", "c.txt"];

await flowbar.each(
  files,
  async (file) => {
    // 파일 하나마다 한 번씩 실행됩니다.
    await upload(file);
  },
  {
    label: "upload",
    concurrency: 4, // 동시에 최대 4개까지 처리합니다.
  },
);
```

각 작업의 결과를 배열로 받고 싶다면 `flowbar.map()`을 씁니다.

```js
import flowbar from "flowbar";

const results = await flowbar.map(
  ["a.txt", "b.txt", "c.txt"],
  async (file) => {
    // return한 값이 results 배열에 순서대로 들어갑니다.
    return upload(file);
  },
  {
    label: "upload",
    concurrency: 4,
  },
);

console.log(results);
```

## Async Iterable

`AsyncIterable`도 같은 방식으로 사용할 수 있습니다. 길이를 자동으로 알 수 없다면 `total`을 직접 넘기면 됩니다.

```js
import flowbar from "flowbar";

async function* jobs() {
  yield "job-a";
  yield "job-b";
  yield "job-c";
}

for await (const job of flowbar(jobs(), { label: "jobs", total: 3 })) {
  // job 하나를 처리할 때마다 progress가 올라갑니다.
  await runJob(job);
}
```

## 수동 Progress Bar

일반적인 반복문으로 표현하기 어려운 작업은 `flowbar.create()`를 쓰면 됩니다.

```js
import flowbar from "flowbar";

const bar = flowbar.create({
  label: "download",
  total: 100,
});

bar.increment(10); // 10만큼 진행합니다.
bar.setPostfix({ phase: "metadata" }); // 오른쪽에 추가 정보를 보여줍니다.
bar.increment(40);
bar.setLabel("install"); // 화면에 보이는 이름을 바꿉니다.
bar.increment(50);
bar.succeed("complete");
```

## 기다리는 작업

전체 개수를 아직 모를 때는 `flowbar.wait()`를 쓰면 됩니다. 가짜 ETA를 만들지 않고, 상태와 경과 시간만 보여줍니다.

```js
import flowbar from "flowbar";

const bar = flowbar.wait({
  label: "connect",
  status: "waiting",
  animation: "marquee",
});

await connectToServer();

bar.succeed("connected");
```

나중에 전체 개수를 알게 되면 일반 progress bar로 바꿀 수 있습니다.

```js
bar.setTotal(10); // 이제 percent와 ETA를 보여줄 수 있습니다.
bar.increment();
```

## Stream byte progress

Node.js stream에서는 `flowbar.stream()`을 쓰면 byte 단위로 진행률을 볼 수 있습니다.

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

## 여러 단계 작업

한 명령 안에 여러 단계가 있으면 `flowbar.task()`를 쓰면 됩니다.

```js
import flowbar from "flowbar";

await flowbar.task("release", async (task) => {
  await task.step("clean", async () => {
    // 한 단계짜리 작업입니다.
    await clean();
  });

  await task.progress("build", ["web", "cli"], async (target) => {
    // 같은 progress bar 안에서 build 진행률을 보여줍니다.
    await build(target);
  });
});
```

## 안전한 로그

progress bar가 떠 있는 중에 `console.log`를 섞으면 화면이 깨질 수 있습니다. 그럴 때는 `bar.log()`, `bar.warn()`, `bar.error()`를 쓰면 됩니다.

```js
import flowbar from "flowbar";

const bar = flowbar.create({ label: "build", total: 3 });

bar.log("build started");
bar.increment();
bar.warn("slow test detected");
bar.increment(2);
bar.succeed("done");
```

## Renderer

flowbar는 환경에 맞는 출력 방식을 자동으로 고릅니다.

- TTY terminal: 같은 줄을 갱신하는 live progress bar
- CI, pipe, non-TTY: ANSI 제어 문자가 없는 plain log
- `renderer: "silent"`: 아무것도 출력하지 않음
- `renderer: "json"`: 줄 단위 JSON 이벤트 출력
- `renderer: "memory"`: 터미널에 쓰지 않고 `onRender`로만 확인

```js
const bar = flowbar.create({
  label: "machine-readable",
  total: 2,
  renderer: "json",
});
```

## 자주 쓰는 옵션

- `label`: 화면에 보이는 작업 이름
- `total`: 전체 작업 개수
- `unit`: `"item"`, `"byte"`, 또는 직접 정한 단위
- `concurrency`: `map`, `each`에서 동시에 처리할 개수
- `interval`: 화면 갱신 최소 간격
- `leave`: 마지막 줄을 남길지 여부
- `charset`: `"unicode"` 또는 `"ascii"`
- `color`: 최종 상태 marker에 색상 적용
- `signal`: `AbortSignal`로 취소 처리

## CI와 자동 배포

이 저장소에는 GitHub Actions workflow가 들어 있습니다.

- `.github/workflows/ci.yml`: push와 pull request에서 typecheck, syntax check, test, package dry-run을 실행합니다.
- `.github/workflows/release.yml`: `vX.Y.Z` 태그가 push되면 npm에 publish하고 GitHub Release를 만듭니다.

예를 들어 `0.1.0`을 배포하려면 다음처럼 태그를 push합니다.

```sh
git tag v0.1.0
git push origin v0.1.0
```

release workflow는 repository secret `NPM_TOKEN`을 사용합니다.

## 로컬 검증

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm pack --dry-run
```

## License

MIT
