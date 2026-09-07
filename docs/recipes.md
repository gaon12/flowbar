# Recipes

These examples are meant to be copied into Node.js scripts and adjusted to your own work. The examples use built-in Node.js APIs unless a note says otherwise.

## Process Files

```js
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { each } from "flowbar";

const inputDir = "data";
const outputDir = "out";
const files = await readdir(inputDir);

await each(
  files,
  async (file) => {
    const input = join(inputDir, file);
    const output = join(outputDir, `${file}.json`);
    const content = await readFile(input, "utf8");
    await writeFile(output, JSON.stringify({ file, length: content.length }));
  },
  { label: "files", concurrency: 4 },
);
```

## Call Many APIs

```js
import { each } from "flowbar";

await each(
  urls,
  async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${url}`);
    }
    await response.arrayBuffer();
  },
  { label: "fetch", concurrency: 8 },
);
```

If a handler throws, the bar is finalized as a failure and the error is rethrown.

## Download With Byte Progress

```js
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { stream } from "flowbar";

const response = await fetch(url);
if (!response.body) {
  throw new Error("Response has no body");
}

const total = Number(response.headers.get("content-length")) || undefined;

await pipeline(
  Readable.fromWeb(response.body),
  stream({ label: "download", total, unit: "byte" }),
  createWriteStream("download.bin"),
);
```

When `content-length` is missing, the stream bar still counts transferred bytes.

## Show Build Steps

```js
import { spawn } from "node:child_process";
import { task } from "flowbar";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.once("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`));
    });
  });
}

await task("release", async (task) => {
  await task.step("clean", () => run("npm", ["run", "clean"]));
  await task.step("build", () => run("npm", ["run", "build"]));
  await task.step("test", () => run("npm", ["test"]));
});
```

## Run Migrations

```js
import { each } from "flowbar";

const rows = await db.query("select id from accounts where migrated = false");

await each(
  rows,
  async (row) => {
    await migrateAccount(row.id);
  },
  { label: "migrate", total: rows.length, concurrency: 2 },
);
```

If the total is unknown, omit `total` and flowbar will show counting progress.

## CI And Non-TTY Output

```js
import { create } from "flowbar";

const bar = create({ label: "ci-safe", total: jobs.length });
for (const job of jobs) {
  await run(job);
  bar.increment();
}
bar.succeed();
```

With the default `renderer: "auto"`, local TTY output uses a live region. CI, pipes, and redirected output use plain lines without terminal control sequences.
