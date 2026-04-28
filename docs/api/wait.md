# API: flowbar.wait(options)

`flowbar.wait(options)`는 남은 예상 시간을 모르는 작업을 표시하는 indeterminate progress를 만듭니다.

## When to Use

- total을 아직 모르거나 아예 알 수 없을 때
- 서버 시작, 연결 대기, metadata discovery처럼 완료 전까지 count가 없는 작업일 때
- fake percent나 fake ETA를 보여 주면 오해가 생기는 작업일 때

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

`flowbar.indeterminate(options)`와 `flowbar.spinner(options)`는 `flowbar.wait(options)`의 별칭입니다.

## animation

지원하는 애니메이션은 다음과 같습니다.

- `spinner`: 작은 회전 표시
- `marquee`: 막대 일부가 오른쪽으로 이동하며 반복
- `bounce`: 막대 일부가 좌우로 왕복
- `pulse`: 막대가 커졌다 작아지는 형태

```js
flowbar.wait({ animation: "spinner" });
flowbar.wait({ animation: "marquee" });
flowbar.wait({ animation: "bounce" });
flowbar.wait({ animation: "pulse" });
```

## fake ETA 금지

indeterminate mode는 전체 작업량을 모르므로 percent, current/total, remaining을 표시하지 않습니다. elapsed와 status만 표시합니다.
나중에 total을 알게 되면 `setTotal()`로 determinate mode가 됩니다.

## determinate로 전환

나중에 전체 작업량을 알게 되면 `setTotal()`을 호출해 determinate mode로 전환할 수 있습니다.

```js
const bar = flowbar.wait({ label: "scan", animation: "marquee" });

const files = await discoverFiles();
bar.setTotal(files.length);

for (const file of files) {
  await processFile(file);
  bar.increment();
}

bar.succeed("done");
```

## Notes

- `flowbar.indeterminate(options)`와 `flowbar.spinner(options)`는 별칭입니다.
- `status`는 `setStatus(status)`로 바꿀 수 있습니다.
- animation timer는 bar 종료 시 정리됩니다.
