import { buildFinalLine, buildLine } from "./layout.js";
import { getTerminalWidth } from "./options.js";
import { TerminalRenderer } from "./terminal.js";
import { now } from "./utils.js";
export class SilentRenderer {
    register() { }
    update() { }
    finalize() { }
    log() { }
    dispose() { }
}
export class MemoryRenderer {
    options;
    constructor(options) {
        this.options = options;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, _force = false) {
        const snapshot = bar.snapshot();
        const width = getTerminalWidth(this.options.output, this.options);
        const line = buildLine(snapshot, width);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const width = getTerminalWidth(this.options.output, this.options);
        this.options.onRender?.(buildFinalLine(snapshot, state, message, width), snapshot);
    }
    log(_bar, level, message) {
        this.options.onRender?.(`${level}: ${message}`, undefined);
    }
    dispose() { }
}
export class PlainRenderer {
    options;
    lastWriteAt;
    constructor(options) {
        this.options = options;
        this.lastWriteAt = 0;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, force = false) {
        const currentTime = now();
        if (!force && currentTime - this.lastWriteAt < Math.max(1000, this.options.interval * 10)) {
            return;
        }
        this.lastWriteAt = currentTime;
        const snapshot = bar.snapshot();
        const line = buildLine(snapshot, getTerminalWidth(this.options.output, this.options));
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const line = buildFinalLine(snapshot, state, message, getTerminalWidth(this.options.output, this.options));
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    log(_bar, level, message) {
        this.options.output.write(`${level}: ${message}\n`);
        this.options.onRender?.(`${level}: ${message}`, undefined);
    }
    dispose() { }
}
export class JsonRenderer {
    options;
    lastWriteAt;
    constructor(options) {
        this.options = options;
        this.lastWriteAt = 0;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, force = false) {
        const currentTime = now();
        if (!force && currentTime - this.lastWriteAt < this.options.interval) {
            return;
        }
        this.lastWriteAt = currentTime;
        const snapshot = bar.snapshot();
        const line = JSON.stringify({ type: "progress", snapshot });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const line = JSON.stringify({ type: "final", state, message, snapshot });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    log(_bar, level, message) {
        const line = JSON.stringify({ type: "log", level, message });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, undefined);
    }
    dispose() { }
}
export function isCiEnvironment() {
    return (process.env.CI === "true" ||
        process.env.GITHUB_ACTIONS === "true" ||
        process.env.GITLAB_CI === "true" ||
        process.env.BITBUCKET_BUILD_NUMBER != null);
}
export function createRenderer(options) {
    if (!options.enabled || options.renderer === "silent") {
        return new SilentRenderer();
    }
    if (options.renderer === "memory") {
        return new MemoryRenderer(options);
    }
    if (options.renderer === "json") {
        return new JsonRenderer(options);
    }
    if (options.renderer === "plain") {
        return new PlainRenderer(options);
    }
    if (options.renderer === "terminal") {
        return new TerminalRenderer(options);
    }
    if (options.output?.isTTY && !isCiEnvironment()) {
        return new TerminalRenderer(options);
    }
    return new PlainRenderer(options);
}
