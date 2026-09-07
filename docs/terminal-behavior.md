# Terminal Behavior

`flowbar`의 터미널 렌더러는 업데이트마다 새 줄을 출력하지 않습니다. 같은 줄 또는 같은 live region을 지우고 다시 그립니다.

## Renderer Selection

`renderer: "auto"`가 기본값입니다.

- TTY이고 CI가 아니면 `terminal`
- CI, pipe, non-TTY이면 `plain`
- `silent`, `json`, `memory`, `plain`, `terminal`은 명시적으로 선택할 수 있습니다.

## Throttling

TTY terminal renderer와 JSON renderer는 빠른 update loop에서 `interval` 기준으로 렌더링을 throttle합니다. 기본 `interval`은 80ms입니다.

강제 렌더링이 필요한 상태 변경과 종료 동작은 즉시 반영됩니다.

## 리사이즈 대응

TTY 출력 스트림의 `columns` 값과 `resize` 이벤트를 사용합니다. 터미널 창 크기가 바뀌면 다음 렌더링에서 progress line 너비를 다시 계산합니다.

기본값은 다음과 같습니다.

```js
import { create } from "flowbar";

create({
  dynamicWidth: true,
  adaptiveLayout: true,
  wrapGuardColumns: 0,
});
```

## 줄바꿈 방지

기본값은 보고된 터미널 폭을 모두 사용합니다. 마지막 칸에서 자동 줄바꿈되는 터미널에서는 `wrapGuardColumns: 1` 이상을 지정해 오른쪽 안전 여백을 둘 수 있습니다.

## 좁은 터미널

터미널 폭이 좁아지면 덜 중요한 필드부터 생략합니다.

1. postfix
2. rate
3. current/total
4. elapsed/remaining ETA
5. bar

문자열 중간을 `…`로 잘라 단위를 훼손하지 않고, 후보 필드를 통째로 생략한 뒤 남는 폭은 bar가 사용합니다.

Determinate bar의 미완료 track은 tqdm처럼 공백이 기본입니다. 이전 음영 표시는 `barTrack: "shaded"`로 선택할 수 있습니다.

## non-TTY와 CI

`renderer: "auto"`에서는 TTY가 아니거나 CI 환경이면 plain renderer로 전환합니다. 이때 ANSI cursor control을 사용하지 않고 줄 단위 로그만 출력합니다.

plain renderer는 과도한 로그를 줄이기 위해 terminal renderer보다 더 보수적으로 갱신합니다.

## Charset and Color

`charset: "ascii"`는 progress bar 문자와 final marker를 ASCII로 제한합니다. 예를 들어 성공 marker는 `[OK]`입니다.

`color: true`는 검은 배경 기준 cyan으로 채워진 progress cell을 표시하고 final marker에는 상태별 색상을 적용합니다. 기본값은 `false`입니다.

`color: "auto"`는 TTY 여부, `NO_COLOR`, `FORCE_COLOR`, `FLOWBAR_BACKGROUND`, `COLORFGBG`를 확인해 어두운 배경에는 cyan, 밝은 배경에는 blue를 선택합니다. `color: "magenta"`, `"bright-green"`처럼 지원되는 ANSI 색상 이름을 주면 수동으로 고정합니다.

## safe logging

progress bar 도중 로그를 남기려면 `bar.log`, `bar.warn`, `bar.error`를 사용합니다.

```js
const bar = create({ total: 10 });
bar.log("started");
bar.increment();
bar.succeed();
```

## Cleanup

terminal renderer는 output별 hub를 공유합니다. 마지막 renderer가 dispose되면 resize listener를 제거합니다.

bar 종료 메서드:

- `succeed(message)`
- `fail(errorOrMessage)`
- `cancel(message)`
- `close(message, options)`

`close(message, { leave: false })`는 해당 종료 호출에서 final line을 남기지 않습니다. `succeed`, `fail`, `cancel`의 최종 출력 동작은 그대로 유지됩니다.
