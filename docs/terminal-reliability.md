# Terminal Reliability Matrix

flowbar treats terminal output stability as part of the product contract. A progress bar should change value without making the layout appear to jump, flicker, or leave stale characters behind.

## Environments

| Environment | Expected behavior |
| --- | --- |
| macOS Terminal | Live region updates stay in place and do not emit plain log noise |
| iTerm2 | Fast updates are throttled and repaint as complete frames |
| Windows Terminal | Clear-only repaint chunks are avoided to reduce visible flicker |
| VS Code integrated terminal | Line shrink and growth clears trailing characters |
| Linux terminal | ANSI cursor movement keeps multi-bar output aligned |
| GitHub Actions | Auto renderer selects plain output |
| Redirected output | No ANSI control sequences are written |
| Pipe output | Progress is readable as plain log lines |

## Rendering Cases

| Case | Verification |
| --- | --- |
| Fast tick update | `terminal renderer throttles tight update loops` |
| Repaint batching | `terminal renderer batches line repaint chunks with content` |
| Count width changes | `determinate bar width stays stable across count and postfix changes` |
| Long postfix | Tail text is truncated instead of resizing the progress bar |
| Task-to-progress transition | `task.progress transitions without leaving a root closed line` |
| ASCII output | `ASCII charset uses ASCII final markers` |
| ANSI color output | `color option emits ANSI styling when enabled` |
| Multi-bar close | `group.close closes tracked child bars` |
| CI and non-TTY | Covered by auto renderer selection and plain renderer behavior |

## Output Rules

- Repaint a live frame as one output chunk where practical.
- Do not write a clear-only chunk followed by content for ordinary progress updates.
- Prefer writing content followed by `ESC[0K` so shorter next lines do not leave stale characters.
- Keep determinate bar width stable for a fixed terminal width and preset.
- Truncate volatile tail text, including long postfix values, before allowing it to resize the bar.
- Use plain renderer output for CI, pipes, and non-TTY destinations.

## Manual Checks

Run these snippets in Windows Terminal, VS Code integrated terminal, and a Unix-like terminal:

```js
import flowbar from "flowbar";

const bar = flowbar.create({ label: "flicker", total: 5000, interval: 16 });
for (let index = 0; index < 5000; index += 1) {
  bar.increment();
  if (index % 3 === 0) {
    bar.setPostfix({ tick: index });
  }
}
bar.succeed("done");
```

```js
import flowbar from "flowbar";

const group = flowbar.group({ label: "batch" });
const first = group.create({ label: "one", total: 100 });
const second = group.create({ label: "two", total: 100 });
for (let index = 0; index < 100; index += 1) {
  first.increment();
  second.increment();
}
group.close();
```
