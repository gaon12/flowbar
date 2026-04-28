# API: flowbar.group(options)

`flowbar.group(options)`는 여러 progress bar를 같은 terminal live region에서 표시하기 위한 간단한 그룹 API입니다.

## When to Use

- 동시에 여러 하위 작업을 보여 주고 싶을 때
- 같은 output stream을 공유하는 여러 bar를 만들 때
- group-level default options를 자식 bar에 넘기고 싶을 때

```js
import flowbar from "flowbar";

const group = flowbar.group({ label: "build" });

const compile = group.create({ label: "compile", total: 100 });
const test = group.create({ label: "test", total: 50 });
const publish = group.wait({ label: "publish", animation: "marquee" });

compile.increment(20);
test.increment(10);
publish.setStatus("waiting");

compile.succeed();
test.succeed();
publish.succeed();
```

group API는 child bar의 기본 옵션을 공유하고, `group.close()`로 아직 열린 child bar를 한 번에 닫을 수 있게 해 줍니다.
실제 live region 관리는 terminal renderer가 수행합니다.

## Notes

- `group.create(childOptions)`는 determinate/counting/manual bar를 만듭니다.
- `group.wait(childOptions)`는 indeterminate bar를 만듭니다.
- child option이 group option보다 우선합니다.
- `group.close()`는 아직 닫히지 않은 child bar를 `close("group closed")`로 종료하고 내부 tracking set을 비웁니다.
- 각 child bar는 필요할 때 `succeed`, `fail`, `cancel`, `close`로 개별 종료할 수도 있습니다.
