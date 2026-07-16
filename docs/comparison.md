# Comparison

flowbar is a progress toolkit for modern Node.js workflows. Existing progress libraries can be excellent at their specific jobs; flowbar focuses on keeping loops, async iterables, concurrent work, streams, and unknown-duration tasks under one API shape.

## Choosing A Tool

| Need | flowbar focus |
| --- | --- |
| Determinate progress bar | default `flowbar(input)` and named `create({ total })` |
| Spinner or unknown-duration work | named `wait()` and `task()` |
| Iterable wrapping | Sync iterables are wrapped without changing yielded values |
| AsyncIterable wrapping | Async iterables are wrapped with the same default import |
| Concurrency helper | named `map()` returns ordered results, `each()` avoids result allocation |
| Stream byte progress | named `stream({ unit: "byte" })` returns a Node.js `Transform` |
| Multi-bar output | named `group()` shares one terminal live region |
| Safe logging | `bar.log()`, `bar.warn()`, and `bar.error()` preserve the live region |
| CI and non-TTY output | `renderer: "auto"` falls back to plain output |
| TypeScript declarations | Declarations are generated from strict TypeScript source |
| Runtime dependencies | No runtime dependencies |

## Positioning

Use flowbar when you want one progress abstraction across several kinds of Node.js work:

- processing files in a loop
- consuming an async data source
- running many promise-returning tasks with bounded concurrency
- tracking byte progress in a stream pipeline
- showing a wait state while a task has no known total

Use a focused spinner or progress-bar package when the app only needs that one UI pattern and does not need iterable, stream, and concurrency helpers.

## Design Priorities

flowbar favors stable terminal rendering, predictable API shapes, and zero runtime dependencies over a large visual theme surface. The goal is not to replace every specialized progress package. The goal is to make common Node.js workflow progress feel like one small toolkit instead of several unrelated helpers.
