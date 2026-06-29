import {
  clampNumber,
  DEFAULT_SPINNER_ASCII,
  DEFAULT_SPINNER_UNICODE,
  displayWidth,
  formatAmount,
  formatBytes,
  formatDuration,
  formatRate,
  isFiniteNumber,
  padLeft,
  pluralizeUnit,
  stringifyPostfix,
  truncateDisplay,
} from "../core/utils.js";
import type {
  FlowbarAnimation,
  FlowbarCharset,
  FlowbarSnapshot,
  RendererFinishState,
  RequiredNormalizedFlowbarOptions,
} from "../types.js";

function makeBar(width: number, ratio: number, charset: Exclude<FlowbarCharset, "auto">): string {
  const safeWidth = Math.max(0, Math.floor(width));
  const safeRatio = clampNumber(Number.isFinite(ratio) ? ratio : 0, 0, 1);
  const filledCount = Math.round(safeWidth * safeRatio);
  const full = charset === "ascii" ? "#" : "█";
  const empty = charset === "ascii" ? "-" : "░";
  return `${full.repeat(filledCount)}${empty.repeat(Math.max(0, safeWidth - filledCount))}`;
}

function makeIndeterminateBar(
  width: number,
  frameIndex: number,
  style: FlowbarAnimation,
  segmentWidth: number | undefined,
  charset: Exclude<FlowbarCharset, "auto">,
): string {
  const safeWidth = Math.max(1, Math.floor(width));
  const full = charset === "ascii" ? "#" : "█";
  const empty = charset === "ascii" ? "-" : "░";
  const segment = clampNumber(Math.floor(segmentWidth || Math.max(3, safeWidth * 0.28)), 1, safeWidth);
  const chars: string[] = Array.from({ length: safeWidth }, () => empty);

  if (style === "pulse") {
    const maxSegment = safeWidth;
    const minSegment = Math.min(segment, maxSegment);
    const cycle = Math.max(1, (maxSegment - minSegment) * 2);
    const step = frameIndex % cycle;
    const size = step <= maxSegment - minSegment ? minSegment + step : maxSegment - (step - (maxSegment - minSegment));
    const start = Math.floor((safeWidth - size) / 2);
    for (let index = start; index < start + size; index += 1) {
      chars[index] = full;
    }
    return chars.join("");
  }

  if (style === "bounce") {
    const maximumPosition = Math.max(0, safeWidth - segment);
    const cycle = Math.max(1, maximumPosition * 2);
    const step = frameIndex % cycle;
    const position = step <= maximumPosition ? step : maximumPosition - (step - maximumPosition);
    for (let index = position; index < position + segment; index += 1) {
      if (index >= 0 && index < chars.length) {
        chars[index] = full;
      }
    }
    return chars.join("");
  }

  const cycle = safeWidth + segment;
  const position = (frameIndex % cycle) - segment;
  for (let index = position; index < position + segment; index += 1) {
    if (index >= 0 && index < chars.length) {
      chars[index] = full;
    }
  }
  return chars.join("");
}

function compactLine(line: string, width: number): string {
  return truncateDisplay(line.replace(/\s+/g, " ").trim(), width);
}

function padDisplayLeft(value: string, width: number): string {
  const padding = Math.max(0, width - displayWidth(value));
  return `${" ".repeat(padding)}${value}`;
}

function clampDisplay(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }
  return truncateDisplay(value, width);
}

function colorize(value: string, code: number, options: Readonly<RequiredNormalizedFlowbarOptions>): string {
  if (!options.color) {
    return value;
  }
  return `\u001B[${code}m${value}\u001B[0m`;
}

function buildDeterminateLine(snapshot: FlowbarSnapshot, width: number): string {
  const { options } = snapshot;
  const current = Math.max(0, snapshot.current);
  const total = Math.max(0, snapshot.total || 0);
  const ratio = total === 0 ? 1 : clampNumber(current / total, 0, 1);
  const percent = `${padLeft(Math.floor(ratio * 100), 3)}%`;
  const label = options.label ? `${options.label}  ` : "";
  const currentAmount = formatAmount(current, options.unit);
  const totalAmount = formatAmount(total, options.unit);
  const countWidth = Math.max(
    displayWidth(`${currentAmount}/${totalAmount}`),
    displayWidth(`${totalAmount}/${totalAmount}`),
  );
  const count = `${padDisplayLeft(currentAmount, Math.max(0, countWidth - displayWidth(`/${totalAmount}`)))}/${totalAmount}`;
  const elapsed = formatDuration(snapshot.timing.elapsedMs);
  const remaining = snapshot.timing.remainingMs == null ? "--:--" : formatDuration(snapshot.timing.remainingMs);
  const rate = formatRate(snapshot.timing.ratePerSecond || 0, options.unit);
  const postfix = stringifyPostfix(snapshot.postfix);
  const charset = options.charset;

  if (options.preset === "minimal") {
    return compactLine(`${label}${percent} ${count}`, width);
  }

  const tailCandidates: string[] = [];
  if (options.preset === "verbose") {
    tailCandidates.push(` ${count}`);
    tailCandidates.push(` elapsed ${elapsed}`);
    tailCandidates.push(` remaining ${remaining}`);
    tailCandidates.push(` ${rate}`);
  } else if (options.preset === "compact") {
    tailCandidates.push(` ${count}`);
    tailCandidates.push(` ${elapsed}<${remaining}`);
  } else {
    tailCandidates.push(` ${count}`);
    tailCandidates.push(` [${elapsed}<${remaining}, ${rate}]`);
  }
  if (postfix) {
    tailCandidates.push(` ${postfix}`);
  }

  const prefix = `${label}${percent} |`;
  const suffix = "|";
  const availableWidth = width - displayWidth(`${prefix}${suffix}`);
  if (availableWidth >= 6) {
    const preferredBarWidth = options.preset === "compact" ? Math.floor(width * 0.42) : Math.floor(width * 0.36);
    const barWidth = clampNumber(preferredBarWidth, 6, availableWidth);
    const tailWidth = Math.max(0, availableWidth - barWidth);
    const bar = makeBar(barWidth, ratio, charset);
    const tail = clampDisplay(tailCandidates.join(""), tailWidth);
    return compactLine(`${prefix}${bar}${suffix}${tail}`, width);
  }

  return compactLine(`${label}${percent} ${count}`, width);
}

function buildCountingLine(snapshot: FlowbarSnapshot, width: number): string {
  const { options } = snapshot;
  const label = options.label ? `${options.label}  ` : "";
  const unit = pluralizeUnit(options.unit || "item", snapshot.current);
  const count =
    options.unit === "byte" ? formatBytes(snapshot.current) : `${formatAmount(snapshot.current, options.unit)} ${unit}`;
  const elapsed = formatDuration(snapshot.timing.elapsedMs);
  const rate = formatRate(snapshot.timing.ratePerSecond || 0, options.unit);
  const postfix = stringifyPostfix(snapshot.postfix);
  const candidates = [
    `${label}${count} | elapsed ${elapsed} | ${rate}${postfix ? ` | ${postfix}` : ""}`,
    `${label}${count} | ${elapsed} | ${rate}`,
    `${label}${count} | ${elapsed}`,
    `${label}${count}`,
  ];
  for (const candidate of candidates) {
    if (displayWidth(candidate) <= width) {
      return candidate;
    }
  }
  return compactLine(candidates[candidates.length - 1], width);
}

function buildIndeterminateLine(snapshot: FlowbarSnapshot, width: number): string {
  const { options } = snapshot;
  const label = options.label ? `${options.label}  ` : "";
  const elapsed = formatDuration(snapshot.timing.elapsedMs);
  const status = snapshot.status || options.status || "running";
  const charset = options.charset;
  const frames = options.spinnerFrames || (charset === "ascii" ? DEFAULT_SPINNER_ASCII : DEFAULT_SPINNER_UNICODE);
  const spinner = frames[snapshot.frameIndex % frames.length];
  const animation = options.animation || "spinner";

  if (animation !== "spinner") {
    const tail = ` ${status} | elapsed ${elapsed}`;
    const fixedWidth = displayWidth(`${label} ||${tail}`);
    const wantedWidth = isFiniteNumber(options.indeterminateWidth) ? options.indeterminateWidth : width - fixedWidth;
    const barWidth = Math.floor(Math.min(Math.max(0, wantedWidth), width - fixedWidth));
    if (barWidth >= 6) {
      const segmentWidth = isFiniteNumber(options.indeterminateSegmentWidth)
        ? options.indeterminateSegmentWidth
        : Math.max(3, Math.floor(barWidth * 0.28));
      const bar = makeIndeterminateBar(barWidth, snapshot.frameIndex, animation, segmentWidth, charset);
      return compactLine(`${label}|${bar}|${tail}`, width);
    }
    if (options.adaptiveLayout !== false) {
      return compactLine(`${label}${spinner} ${status} | elapsed ${elapsed}`, width);
    }
  }

  const candidates = [
    `${label}${spinner} ${status} | elapsed ${elapsed}`,
    `${label}${spinner} ${status}`,
    `${label}${spinner}`,
  ];
  for (const candidate of candidates) {
    if (displayWidth(candidate) <= width) {
      return candidate;
    }
  }
  return compactLine(candidates[candidates.length - 1], width);
}

export function buildFinalLine(
  snapshot: FlowbarSnapshot,
  state: RendererFinishState,
  message: string,
  width: number,
): string {
  const { options } = snapshot;
  const label = options.label || "flowbar";
  const elapsed = formatDuration(snapshot.timing.elapsedMs);
  const suffix = message ? ` | ${message}` : "";
  const successMarker = colorize(options.charset === "ascii" ? "[OK]" : "✔", 32, options);
  const failureMarker = colorize(options.charset === "ascii" ? "[ERR]" : "✖", 31, options);
  const cancelledMarker = colorize(options.charset === "ascii" ? "[CANCEL]" : "■", 33, options);
  if (state === "success") {
    if (snapshot.total != null) {
      return compactLine(
        `${successMarker} ${label}  done in ${elapsed} | ${formatAmount(snapshot.current, options.unit)}/${formatAmount(snapshot.total, options.unit)}${suffix}`,
        width,
      );
    }
    return compactLine(`${successMarker} ${label}  done in ${elapsed}${suffix}`, width);
  }
  if (state === "failure") {
    return compactLine(`${failureMarker} ${label}  failed after ${elapsed}${suffix}`, width);
  }
  if (state === "cancelled") {
    return compactLine(`${cancelledMarker} ${label}  cancelled after ${elapsed}${suffix}`, width);
  }
  return compactLine(`${label}  closed after ${elapsed}${suffix}`, width);
}

export function buildLine(snapshot: FlowbarSnapshot, width: number): string {
  const safeWidth = Math.max(1, Math.floor(width));
  if (snapshot.mode === "determinate") {
    return buildDeterminateLine(snapshot, safeWidth);
  }
  if (snapshot.mode === "counting") {
    return buildCountingLine(snapshot, safeWidth);
  }
  return buildIndeterminateLine(snapshot, safeWidth);
}
