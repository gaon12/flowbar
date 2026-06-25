# Terminal Behavior

`flowbar`의 터미널 렌더러는 업데이트마다 새 줄을 출력하지 않습니다. 같은 줄 또는 같은 live region을 지우고 다시 그립니다.

## Renderer Selection

`renderer: "auto"`가 기본값입니다.

- TTY이고 CI가 아니면 `terminal`
- CI, pipe, non-TTY이면 `plain`
- `silent`, `json`, `memory`, `plain`, `terminal`은 명시적으로 선택할 수 있습니다.

## Throttling

TTY terminal renderer는 빠른 update loop에서 `interval` 기준으로 live region 렌더링을 throttle합니다. 기본 `interval`은 80ms입니다.

강제 렌더링이 필요한 상태 변경과 종료 동작은 즉시 반영됩니다.

## 리사이즈 대응

TTY 출력 스트림의 `columns` 값과 `resize` 이벤트를 사용합니다. 터미널 창 크기가 바뀌면 다음 렌더링에서 progress line 너비를 다시 계산합니다.

기본값은 다음과 같습니다.

```js
flowbar.create({
  dynamicWidth: true,
  adaptiveLayout: true,
  wrapGuardColumns: 1,
});
```

## 줄바꿈 방지

터미널 마지막 칸까지 꽉 채우면 일부 환경에서 자동 줄바꿈이 발생할 수 있습니다. `wrapGuardColumns`는 이를 막기 위해 오른쪽에 남기는 여유 칸 수입니다.

## 좁은 터미널

터미널 폭이 좁아지면 덜 중요한 필드부터 생략합니다.

1. postfix
2. rate
3. remaining
4. elapsed
5. current/total
6. bar

최소 상태에서는 label, percent, count 중심으로 남깁니다.

## non-TTY와 CI

`renderer: "auto"`에서는 TTY가 아니거나 CI 환경이면 plain renderer로 전환합니다. 이때 ANSI cursor control을 사용하지 않고 줄 단위 로그만 출력합니다.

plain renderer는 과도한 로그를 줄이기 위해 terminal renderer보다 더 보수적으로 갱신합니다.

## Charset and Color

`charset: "ascii"`는 progress bar 문자와 final marker를 ASCII로 제한합니다. 예를 들어 성공 marker는 `[OK]`입니다.

`color: true`를 설정하면 final marker에 ANSI 색상을 적용합니다. 기본값은 `false`이며, non-TTY에서 ANSI를 피하려면 기본값을 유지합니다.

## safe logging

progress bar 도중 로그를 남기려면 `bar.log`, `bar.warn`, `bar.error`를 사용합니다.

```js
const bar = flowbar.create({ total: 10 });
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
