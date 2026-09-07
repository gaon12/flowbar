import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const probe = `
import flowbar from './dist/index.js';
const writes=[];
const output={isTTY:process.env.PROBE_TTY==='1',columns:80,write:s=>writes.push(s)};
const bar=flowbar.create({total:2,output,label:'copy'});
bar.increment();bar.succeed();
process.stdout.write(JSON.stringify({text:writes.join(''),charset:bar.options.charset}));
`;

for (const [name, overrides, terminal, charset] of [
  ["TTY Unicode", { PROBE_TTY: "1" }, true, "unicode"],
  ["pipe", {}, false, "ascii"],
  ["CI true", { PROBE_TTY: "1", CI: "true" }, false, "unicode"],
  ["CI 1", { PROBE_TTY: "1", CI: "1" }, false, "unicode"],
  ["CI false", { PROBE_TTY: "1", CI: "false" }, true, "unicode"],
  ["CI zero", { PROBE_TTY: "1", CI: "0" }, true, "unicode"],
  ["GitHub Actions", { PROBE_TTY: "1", GITHUB_ACTIONS: "true" }, false, "unicode"],
  ["GitLab", { PROBE_TTY: "1", GITLAB_CI: "true" }, false, "unicode"],
  ["Bitbucket", { PROBE_TTY: "1", BITBUCKET_BUILD_NUMBER: "2" }, false, "unicode"],
  ["dumb terminal", { PROBE_TTY: "1", TERM: "dumb" }, false, "unicode"],
  ["C locale", { PROBE_TTY: "1", LC_ALL: "C" }, true, "ascii"],
  ["forced ASCII", { PROBE_TTY: "1", FLOWBAR_ASCII: "1" }, true, "ascii"],
  ["Unicode pipe", { FLOWBAR_UNICODE: "1" }, false, "unicode"],
]) {
  test(`isolated process: ${name}`, () => {
    const env = { ...process.env };
    for (const key of [
      "CI",
      "GITHUB_ACTIONS",
      "GITLAB_CI",
      "BITBUCKET_BUILD_NUMBER",
      "TERM",
      "LC_ALL",
      "LANG",
      "FLOWBAR_ASCII",
      "FLOWBAR_UNICODE",
      "PROBE_TTY",
    ])
      delete env[key];
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      encoding: "utf8",
      env: { ...env, ...overrides },
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout);
    assert.equal(value.text.includes("\x1b["), terminal);
    assert.equal(value.charset, charset);
  });
}

test("default output leaves stdout free for application data", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import f from './dist/index.js'; const b=f.create({total:1}); b.increment(); b.succeed(); console.log('payload');",
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "payload");
  assert.ok(result.stderr.includes("done"));
  assert.equal(result.stderr.includes("\x1b"), false);
});
