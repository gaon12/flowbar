# Changelog

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
