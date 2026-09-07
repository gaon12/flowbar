import { setTimeout as delay } from "node:timers/promises";
import flowbar from "../dist/index.js";

// Run in a real terminal for live output, or redirect stderr to inspect plain logs.
const output = process.stderr;
for (const charset of ["unicode", "ascii"]) {
  const bar = flowbar.create({ label: `download (${charset})`, total: 100, charset, output });
  for (const value of [0, 12, 25, 50, 75, 100]) {
    bar.update(value);
    await delay(100);
  }
  bar.succeed();
}
const group = flowbar.group({ output });
const build = group.create({ label: "한글 build 👩‍💻", total: 3 });
const waiting = group.wait({ label: "connect", animation: "bounce" });
for (let index = 0; index < 3; index++) {
  await delay(120);
  build.increment();
}
build.log("build artifacts ready");
build.succeed();
waiting.succeed("connected");
group.close();
