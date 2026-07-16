import assert from "node:assert/strict";
import { resolve } from "node:path";
import { spawn } from "node-pty";

const workspace = resolve(import.meta.dirname, "..");
const fixture = resolve(workspace, "scripts/fixtures/pty-smoke.mjs");

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteShell(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function shellCommand() {
  if (process.platform === "win32") {
    return {
      file: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `& ${quotePowerShell(process.execPath)} ${quotePowerShell(fixture)}`,
      ],
    };
  }
  return {
    file: "/bin/sh",
    args: ["-lc", `${quoteShell(process.execPath)} ${quoteShell(fixture)}`],
  };
}

async function runPtyTest() {
  const command = shellCommand();
  const terminal = spawn(command.file, command.args, {
    name: "xterm-256color",
    cols: 12,
    rows: 8,
    cwd: workspace,
    env: { ...process.env, TERM: "xterm-256color" },
  });
  let output = "";
  let resizeTimer;
  let flowControlTimer;
  let resizeIndex = 0;
  let exited = false;
  const dataSubscription = terminal.onData((chunk) => {
    output += chunk;
    if (!resizeTimer && output.includes("PTY=true")) {
      terminal.pause();
      flowControlTimer = setTimeout(() => {
        if (!exited) {
          terminal.resume();
        }
      }, 30);
      const sizes = [
        [10, 8],
        [24, 8],
        [40, 10],
      ];
      resizeTimer = setInterval(() => {
        if (exited) {
          return;
        }
        try {
          const [columns, rows] = sizes[resizeIndex % sizes.length];
          resizeIndex += 1;
          terminal.resize(columns, rows);
        } catch {
          // The PTY can exit between the guard and a resize call.
        }
      }, 5);
    }
  });

  let exitSubscription;
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      terminal.kill();
      rejectExit(new Error(`PTY child timed out.\n${output}`));
    }, 10_000);
    exitSubscription = terminal.onExit(({ exitCode: code }) => {
      exited = true;
      clearTimeout(timeout);
      resolveExit(code);
    });
  });
  clearInterval(resizeTimer);
  clearTimeout(flowControlTimer);
  exitSubscription.dispose();
  dataSubscription.dispose();

  assert.equal(exitCode, 0, output);
  assert.match(output, /PTY=true/);
  assert.match(output, /COLUMNS=12/);
  assert.match(output, /UNICODE=한글\|👨‍👩‍👧‍👦\|👍🏽/);
  assert.match(output, /GROUP_SIZE=0/);
  assert.match(output, /LOGGED=1/);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: PTY output must contain an ANSI ESC sequence.
  assert.match(output, /\u001B\[/);
  assert.doesNotMatch(output, /\uFFFD/);
}

try {
  await runPtyTest();
  console.log("PTY integration passed.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  process.exit(process.exitCode ?? 0);
}
