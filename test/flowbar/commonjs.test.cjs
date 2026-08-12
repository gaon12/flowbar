const assert = require("node:assert/strict");
const test = require("node:test");
const flowbar = require("flowbar");

test("CommonJS require returns a callable wrapper with named helpers", () => {
  assert.equal(typeof flowbar, "function");
  assert.equal(flowbar.default, flowbar);
  assert.equal(typeof flowbar.create, "function");
  assert.equal(typeof flowbar.each, "function");

  const values = [...flowbar([1, 2, 3], { renderer: "silent" })];
  assert.deepEqual(values, [1, 2, 3]);

  const bar = flowbar.create({ total: 1, renderer: "silent" });
  bar.increment().succeed();
  assert.equal(bar.closed, true);
});
