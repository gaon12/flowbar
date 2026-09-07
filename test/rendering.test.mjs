import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { displayWidth, stripAnsi, truncateDisplay } from "../dist/display.js";
import flowbar from "../dist/index.js";
import { makeBar } from "../dist/layout.js";

class Terminal extends EventEmitter {
  isTTY = true;
  columns = 80;
  writes = [];
  write(text) {
    this.writes.push(text);
  }
}

test("tqdm bars keep blank space and fractional Unicode blocks at every percentage", () => {
  for (const charset of ["ascii", "unicode"]) {
    for (let percent = 0; percent <= 100; percent++) {
      const bar = makeBar(30, percent / 100, charset);
      assert.equal(displayWidth(bar), 30);
      assert.doesNotMatch(bar, /[░▒▓-]/);
      if (percent < 100) assert.ok(bar.includes(" ") || percent > 96);
    }
  }
  assert.equal(makeBar(8, 0.15625, "unicode"), "█▎      ");
  assert.equal(makeBar(8, 0, "unicode"), "        ");
  assert.equal(makeBar(8, 1, "unicode"), "████████");
});

test("all presets and modes fit widths 1–160 with Korean, ANSI and grapheme labels", () => {
  for (const width of [1, 2, 6, 10, 20, 40, 79, 80, 120, 160]) {
    for (const preset of ["tqdm", "minimal", "compact", "verbose"]) {
      for (const charset of ["ascii", "unicode"]) {
        for (const label of [
          "copy",
          "한글 다운로드",
          "👨‍👩‍👧‍👦 cafe\u0301 🇰🇷",
          "\x1b[31mred\x1b[0m",
        ]) {
          const lines = [];
          const bar = flowbar.create({
            width,
            preset,
            charset,
            label,
            total: 100,
            renderer: "memory",
            onRender: (line) => lines.push(line),
          });
          bar.update(25);
          bar.setTotal(undefined);
          bar.setMode("indeterminate");
          bar.succeed();
          for (const line of lines)
            assert.ok(
              displayWidth(line) <= width,
              JSON.stringify({ width, preset, charset, line }),
            );
        }
      }
    }
  }
});

test("rendered bars preserve empty cells instead of collapsing spaces", () => {
  let line;
  const bar = flowbar.create({
    total: 100,
    width: 80,
    charset: "unicode",
    renderer: "memory",
    onRender: (value) => {
      line = value;
    },
  });
  assert.match(line, /\| {6,}\|/);
  assert.equal(displayWidth(line), 80);
  bar.update(25);
  assert.match(line, /█[█▏▎▍▌▋▊▉]* {6,}\|/);
  bar.close();
});

test("grapheme widths and truncation do not split emoji or combining sequences", () => {
  for (const [text, width] of [
    ["한글", 4],
    ["e\u0301", 1],
    ["👨‍👩‍👧‍👦", 2],
    ["🇰🇷", 2],
    ["👍🏽", 2],
    ["1️⃣", 2],
  ]) {
    assert.equal(displayWidth(text), width, text);
    assert.equal(truncateDisplay(`${text}abcdef`, width + 1), `${text}…`);
  }
  assert.equal(truncateDisplay("\x1b[31mabcdef\x1b[0m", 3), "\x1b[31mab…\x1b[0m");
});

test("plain output strips ANSI even when color and styled user text are supplied", () => {
  const lines = [];
  const bar = flowbar.create({
    total: 1,
    renderer: "plain",
    color: true,
    label: "\x1b[31mred\x1b[0m",
    output: { write: (s) => lines.push(s) },
  });
  bar.log("\x1b]8;;https://example.org\x07link\x1b]8;;\x07\nsecond line");
  bar.succeed();
  assert.equal(lines.join(""), stripAnsi(lines.join("")));
  assert.equal(lines.length, 3);
  assert.equal(lines[1].split("\n").length, 2);
});

test("plain and JSON waiting bars do not emit animation-only events", async () => {
  for (const renderer of ["plain", "json"]) {
    const lines = [];
    const bar = flowbar.wait({ renderer, interval: 16, output: { write: (s) => lines.push(s) } });
    await delay(65);
    assert.equal(lines.length, 1, renderer);
    bar.succeed();
    assert.equal(lines.length, 2);
  }
});

test("terminal resize, shared bars, logging and leave=false release listeners", () => {
  const output = new Terminal();
  const rendered = [];
  const first = flowbar.create({
    output,
    renderer: "terminal",
    total: 2,
    width: 160,
    onRender: (line) => rendered.push(line),
  });
  const second = flowbar.wait({ output, renderer: "terminal", leave: false });
  assert.equal(output.listenerCount("resize"), 1);
  output.columns = 20;
  rendered.length = 0;
  output.emit("resize");
  assert.ok(rendered.every((line) => displayWidth(line) <= 19));
  first.log("hello");
  second.close();
  first.succeed();
  assert.equal(output.listenerCount("resize"), 0);
  assert.ok(output.writes.join("").includes("info: hello"));
});

test("ASCII truncation stays ASCII and terminal text cannot insert control sequences", () => {
  const lines = [];
  const bar = flowbar.create({
    total: 2,
    width: 10,
    charset: "ascii",
    label: "longlonglong",
    renderer: "memory",
    onRender: (s) => lines.push(s),
  });
  bar.setLabel("abc\n\x1b[2Jdef");
  bar.succeed();
  for (const line of lines) assert.match(line, /^[\x20-\x7e]*$/);
});
