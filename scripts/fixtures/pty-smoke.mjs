import { setTimeout as delay } from "node:timers/promises";

// Runs only inside the PTY integration harness.
import { group } from "../../dist/index.js";

process.stdout.write(`PTY=${process.stderr.isTTY};COLUMNS=${process.stderr.columns}\n`);
process.stdout.write("UNICODE=한글|👨‍👩‍👧‍👦|👍🏽\n");

const bars = group({
  output: process.stderr,
  renderer: "terminal",
  charset: "unicode",
  interval: 16,
});
const download = bars.create({ label: "다운로드 👨‍👩‍👧‍👦", total: 20 });
const resize = bars.wait({ label: "resize", animation: "bounce" });

for (let index = 0; index < 20; index += 1) {
  download.increment();
  if (index === 5) {
    download.log("교차 로그 👍🏽");
  }
  await delay(2);
}

download.succeed("완료");
resize.succeed("resized");
process.stdout.write(`GROUP_SIZE=${bars.size}\n`);
process.stdout.write("LOGGED=1\n");
await delay(20);
