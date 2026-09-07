import assert from "node:assert/strict";
import test from "node:test";
import { create } from "../../dist/index.js";

test("color true uses the dark-terminal palette for the bar and semantic final state", () => {
  const lines = [];
  const bar = create({
    label: "color",
    total: 1,
    color: true,
    renderer: "memory",
    onRender: (line) => lines.push(line),
  });
  bar.increment();
  bar.succeed();
  assert.ok(lines.some((line) => line.includes("\u001B[36m")));
  assert.ok(lines.at(-1).includes("\u001B[32m"));
});

test("auto color adapts to dark and light terminal backgrounds", () => {
  const originalColorFgBg = process.env.COLORFGBG;
  const originalNoColor = process.env.NO_COLOR;
  const lines = [];
  const output = { isTTY: true, columns: 60, write() {} };

  try {
    delete process.env.NO_COLOR;
    process.env.COLORFGBG = "15;0";
    const dark = create({
      total: 2,
      current: 1,
      color: "auto",
      renderer: "memory",
      output,
      onRender: (line) => lines.push(line),
    });
    assert.equal(dark.options.color, "cyan");
    assert.ok(lines.at(-1).includes("\u001B[36m"));
    dark.close();

    process.env.COLORFGBG = "0;15";
    const light = create({
      total: 2,
      current: 1,
      color: "auto",
      renderer: "memory",
      output,
      onRender: (line) => lines.push(line),
    });
    assert.equal(light.options.color, "blue");
    assert.ok(lines.at(-1).includes("\u001B[34m"));
    light.close();
  } finally {
    if (originalColorFgBg == null) delete process.env.COLORFGBG;
    else process.env.COLORFGBG = originalColorFgBg;
    if (originalNoColor == null) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = originalNoColor;
  }
});

test("named colors force a manual progress color", () => {
  const lines = [];
  const bar = create({
    total: 2,
    current: 1,
    color: "magenta",
    renderer: "memory",
    output: { columns: 60, write() {} },
    onRender: (line) => lines.push(line),
  });
  assert.equal(bar.options.color, "magenta");
  assert.ok(lines[0].includes("\u001B[35m"));
  bar.close();
});
