# API: flowbar.create(options)

`flowbar.create(options)`는 수동으로 제어하는 `ProgressBar`를 만듭니다.

## When to Use

- 전체 작업량을 직접 알고 있고 직접 `increment()` 또는 `update()`를 호출할 때
- 작업 중 status/postfix/log를 세밀하게 제어할 때
- iterable helper보다 수동 제어가 더 자연스러운 workflow일 때

```js
import flowbar from "flowbar";

const bar = flowbar.create({ label: "download", total: 100 });

bar.increment(10);
bar.update(50);
bar.setPostfix({ phase: "files" });
bar.succeed("complete");
```

## ProgressBar 메서드

### increment(delta = 1)

현재 값을 `delta`만큼 증가시킵니다.
`delta`는 finite number여야 합니다. 결과 current는 0 아래로 내려가지 않습니다.

```js
bar.increment();
bar.increment(5);
```

### update(value)

현재 값을 지정한 값으로 바꿉니다.
`value`는 finite number여야 합니다. 음수는 0으로 clamp됩니다.

```js
bar.update(42);
```

### setTotal(total)

전체 작업량을 설정합니다. total을 설정하면 determinate mode로 전환됩니다.
`total`은 `number`, `null`, `undefined`만 의미가 있습니다. number는 finite이고 0 이상이어야 합니다.
`null` 또는 `undefined`는 total을 제거합니다.

```js
bar.setTotal(100);
bar.setTotal(undefined);
```

### setMode(mode)

진행 모드를 바꿉니다.
허용값은 `"auto"`, `"determinate"`, `"counting"`, `"indeterminate"`입니다.

```js
bar.setMode("indeterminate");
bar.setMode("determinate");
```

### setStatus(status)

indeterminate mode의 상태 메시지를 바꿉니다.

```js
bar.setStatus("fetching metadata");
```

### setPostfix(postfix)

오른쪽에 표시할 추가 정보를 설정합니다.
값이 `null` 또는 `undefined`인 항목은 출력하지 않습니다.

```js
bar.setPostfix({ file: "a.txt", retry: 2 });
```

### log, warn, error

터미널 live region을 깨지 않으면서 로그를 출력합니다.

```js
bar.log("started");
bar.warn("slow response");
bar.error("failed request");
```

### close, succeed, fail, cancel

bar를 종료합니다.
종료 후 추가 update는 무시됩니다.

```js
bar.succeed("done");
bar.fail(new Error("compile failed"));
bar.cancel("user cancelled");
bar.close();
```

### snapshot()

현재 진행 상태를 읽습니다.

```js
const snapshot = bar.snapshot();
console.log(snapshot.timing.elapsedMs);
console.log(snapshot.timing.remainingMs);
console.log(snapshot.timing.ratePerSecond);
```

`ProgressBar`의 공개 상태(`current`, `total`, `status`, `postfix`, `startedAt`, `updatedAt`, `frameIndex`, `closed`, `options`)는 읽기용 getter입니다.
상태를 바꿀 때는 직접 대입하지 말고 `increment`, `update`, `setTotal`, `setStatus`, `setPostfix`, 종료 메서드를 사용합니다.

## Renderer Notes

- `renderer: "silent"`는 출력하지 않지만 snapshot과 method 동작은 유지합니다.
- `renderer: "memory"`는 테스트용이며 `onRender(line, snapshot)`으로 렌더 결과를 받습니다.
- TTY terminal renderer는 빠른 update loop에서 `interval` 기준으로 갱신을 throttle합니다.
- `charset: "ascii"`에서는 final marker도 ASCII로 출력합니다.
- `color: true`는 final marker에 ANSI 색상을 적용합니다.
