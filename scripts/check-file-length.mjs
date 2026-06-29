import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["src", "test", "scripts"];
const EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx"]);
const MAX_LINES = 350;
const oversized = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      const lineCount = (await readFile(path, "utf8")).split(/\r?\n/).length;
      if (lineCount > MAX_LINES) {
        oversized.push(`${relative(process.cwd(), path)}: ${lineCount} lines`);
      }
    }
  }
}

await Promise.all(ROOTS.map(visit));

if (oversized.length > 0) {
  console.error(`Files must not exceed ${MAX_LINES} lines:\n${oversized.join("\n")}`);
  process.exitCode = 1;
}
