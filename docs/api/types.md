# API: TypeScript Types

`flowbar`는 `dist/index.d.ts`를 포함합니다. 별도의 `@types` 패키지가 필요하지 않습니다.
source는 strict TypeScript로 검사하고 `npm run build`에서 `dist/index.js`와 `dist/index.d.ts`를 생성합니다.

## 주요 타입

```ts
import flowbar, {
  ProgressBar,
  FlowbarOptions,
  FlowbarMapOptions,
  FlowbarSnapshot,
  FlowbarMode,
  FlowbarAnimation,
  FlowbarRenderCallback,
  WritableLike,
} from "flowbar";
```

## FlowbarOptions

```ts
type FlowbarOptions = {
  label?: string;
  total?: number;
  current?: number;
  unit?: "item" | "byte" | string;
  mode?: "auto" | "determinate" | "counting" | "indeterminate";
  status?: string;
  animation?: "spinner" | "marquee" | "bounce" | "pulse";
  indeterminateStyle?: "spinner" | "marquee" | "bounce" | "pulse";
  indeterminateWidth?: number;
  indeterminateSegmentWidth?: number;
  indeterminateInterval?: number;
  enabled?: boolean;
  renderer?: "auto" | "terminal" | "plain" | "silent" | "json" | "memory";
  output?: WritableLike;
  interval?: number;
  width?: number;
  dynamicWidth?: boolean;
  wrapGuardColumns?: number;
  adaptiveLayout?: boolean;
  leave?: boolean;
  color?: boolean;
  charset?: "auto" | "unicode" | "ascii";
  signal?: AbortSignal;
  postfix?: Record<string, unknown>;
  preset?: "tqdm" | "compact" | "verbose" | "minimal";
  spinnerFrames?: readonly string[];
  rateSmoothing?: number;
  minElapsedMsForEta?: number;
  onRender?: FlowbarRenderCallback;
};
```

정확한 선언은 `dist/index.d.ts`를 기준으로 합니다.

## Runtime Validation

TypeScript 사용자가 아니어도 런타임 검증이 적용됩니다.

- `total`, `current`, `update(value)`, `setTotal(total)`, `increment(delta)`, `concurrency`는 finite number여야 합니다.
- 저장되는 `total`과 초기 `current`는 0 이상이어야 합니다.
- `update(value)`와 `increment(delta)` 결과 current는 0 아래로 내려가지 않습니다.
- `mode`, `animation`, `preset`은 선언된 문자열 union만 허용합니다.

## Important Types

- `FlowbarFunction`: default export의 callable API와 static helpers
- `ProgressBar`: 수동 bar class
- `FlowbarOptions`: 모든 renderer/helper 공통 옵션
- `FlowbarMapOptions`: `FlowbarOptions & { concurrency?: number }`
- `FlowbarSnapshot`: `snapshot()`과 `onRender`가 받는 상태 객체
- `WritableLike`: custom output stream 최소 contract

## ProgressBar Public State

`ProgressBar`는 `current`, `total`, `status`, `postfix`, `startedAt`, `updatedAt`, `frameIndex`, `closed`, `options`를 읽기용 getter로 제공합니다.
외부 코드는 이 값을 직접 대입하지 않고, `increment`, `update`, `setTotal`, `setStatus`, `setPostfix`, `succeed`, `fail`, `cancel`, `close`를 사용해 상태를 변경합니다.

`options` getter는 내부 옵션 객체가 아니라 읽기용 복사본을 반환하므로, 반환값을 변경해도 bar의 동작은 바뀌지 않습니다.
