# Changelog

## Unreleased

- Split the default callable iterable wrapper from named helper exports and make `configure()` return a non-callable client.
- Keep task root bars alive across child progress steps.
- Count encoded string chunks as bytes and separate stream object mode from byte mode.
- Bound concurrency, propagate a cooperative cancellation signal, and await in-flight cleanup on failure.
- Deeply isolate data-only snapshots and throttle safe JSON progress events.
- Release closed child bars from group tracking automatically.
- Preserve grapheme clusters in terminal width calculation and fix total-clearing mode transitions.
- Add real PTY coverage, including Windows ConPTY through PowerShell, resize bursts, narrow widths, Unicode, and flow control.

## 0.1.2

- Split the source and tests into focused modules capped at 350 lines.
- Add Biome linting, formatting, and automated file-length enforcement.
- Consolidate local and CI validation into a single command.
- Publish npm packages and GitHub Releases automatically from version tags.

## 0.1.1

- Stabilize terminal repaint behavior to reduce flicker.
- Avoid idle animation timers for determinate and counting bars.
- Keep determinate bar width stable while tail text changes.
- Rebuild before tests so stale `dist` output cannot hide source changes.
- Add terminal renderer regression tests.
- Add Node.js 20.x, 22.x, and 24.x CI coverage.
- Add GitHub Release to npm publish workflow.
- Add recipes, comparison, terminal reliability, task API, and release documentation.

## 0.1.0

- Initial release.
