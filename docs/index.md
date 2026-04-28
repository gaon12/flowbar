# flowbar Docs Index

This file is the short entry point for humans and LLMs. Prefer the smallest API file that matches the task instead of reading all docs.

## Routing

- Use `docs/quickstart.md` for the smallest working examples.
- Use `docs/llm-guide.md` when generating code.
- Use `docs/api/flowbar.md` for wrapping `Iterable` or `AsyncIterable`.
- Use `docs/api/create.md` for manual `ProgressBar` control.
- Use `docs/api/map.md` for `map` and `each` concurrency helpers.
- Use `docs/api/stream.md` for Node.js `Transform` byte progress.
- Use `docs/api/wait.md` for indeterminate work.
- Use `docs/api/group.md` for multiple bars in one terminal live region.
- Use `docs/api/types.md` for TypeScript names and option shapes.
- Use `docs/terminal-behavior.md` for renderer, throttling, TTY, CI, width, and logging behavior.
- Use `docs/full.md` only when a single combined document is needed.

## Core Contract

- Default import: `import flowbar from "flowbar";`
- Default output: `stderr`.
- Default renderer: `auto`.
- TTY renderer updates a live region and throttles fast update loops by `interval`.
- CI, pipe, and non-TTY output use plain line rendering.
- `flowbar.map` returns ordered results.
- `flowbar.each` returns `undefined` and does not allocate a result array.
- Mapper or handler failure closes the bar and calls async iterator `return()` when available.
- Numeric runtime inputs must be finite. Negative totals and current values are rejected where they define stored progress state.
