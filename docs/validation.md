# 검증 방법

변경마다 코드 수정 → `npm run lint:fix` → `npm run lint` 및 `npm run format:check` → `npm test` → 커밋 순서로 진행합니다.
Biome은 개발 도구이며 배포 패키지의 런타임 의존성은 0개입니다.

## 자동 검증

- 기본 API, 설정 API, iterator 정리, 동시 작업 실패·취소, 늦은 종료 콜백.
- JSON 출력의 순환 참조·BigInt·공유 객체·출력 장치 제외.
- 폭 1–160, 네 가지 preset, 두 charset, 영문·한글·ANSI·결합 이모지 조합 320개.
- 0–100%의 ASCII/Unicode 막대, 빈 칸 보존과 부분 블록.
- 가상 TTY 리사이즈, 여러 막대, 안전 로그, listener 해제, ASCII 줄임표.
- 별도 프로세스의 TTY, pipe, CI=true/1/false/0, GitHub/GitLab/Bitbucket, TERM=dumb, C locale, charset 강제 설정.
- stream 입력/중간/쓰기/final 실패, 지연된 목적지 완료, 실제 AbortSignal 취소, backpressure.

GitHub Actions는 Ubuntu, Windows, macOS와 Node 20, 22, 24의 9개 조합을 설정합니다.
로컬 실행과 원격 CI 실행 결과는 구분해야 합니다. 가상 TTY 테스트는 실제 터미널별 글꼴·Unicode 폭 차이를 완전히 보장하지 않습니다.

## 2026-09-07 로컬 검증

- Windows에서 Node 20.20.0, 22.22.0, 24.16.0으로 전체 테스트 실행.
- 실제 ConPTY에서 TERM=xterm-256color로 ASCII/Unicode 막대와 한글·결합 이모지 다중 막대 실행. Windows 결합 이모지에 여유 칸을 확보해 자동 줄바꿈을 방지.
- TERM=dumb 및 stderr 리다이렉션의 plain 로그 확인.
- npm tarball을 별도 소비자 폴더에 설치해 ESM import, configured constructor, map 결과 및 런타임 의존성 0개 확인.
- Linux/macOS는 CI 구성을 추가했으며 로컬에서 실행한 것으로 간주하지 않음.

## 수동 출력 확인

```sh
node examples/preview.mjs
node examples/preview.mjs 2> progress.log
```

첫 명령은 실제 TTY이면 한 줄 갱신과 여러 막대를 보여줍니다. 두 번째 명령은 ANSI 없는 plain 로그를 만듭니다.
최종 저장 성공이 필요한 stream은 `progress.track(pipeline(...))`을 즉시 호출해야 합니다.
