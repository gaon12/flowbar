"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRenderer = createRenderer;
const options_js_1 = require("../core/options.js");
const snapshot_js_1 = require("../core/snapshot.js");
const utils_js_1 = require("../core/utils.js");
const format_js_1 = require("./format.js");
class SilentRenderer {
    register() { }
    update() { }
    finalize() { }
    log() { }
    dispose() { }
}
class MemoryRenderer {
    options;
    constructor(options) {
        this.options = options;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, _force = false) {
        const snapshot = bar.snapshot();
        const width = (0, options_js_1.getTerminalWidth)(this.options.output, this.options);
        const line = (0, format_js_1.buildLine)(snapshot, width);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const width = (0, options_js_1.getTerminalWidth)(this.options.output, this.options);
        this.options.onRender?.((0, format_js_1.buildFinalLine)(snapshot, state, message, width), snapshot);
    }
    log(_bar, level, message) {
        this.options.onRender?.(`${level}: ${message}`, undefined);
    }
    dispose() { }
}
class PlainRenderer {
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
        const currentTime = (0, utils_js_1.now)();
        if (!force && currentTime - this.lastWriteAt < Math.max(1000, this.options.interval * 10)) {
            return;
        }
        this.lastWriteAt = currentTime;
        const snapshot = bar.snapshot();
        const line = (0, format_js_1.buildLine)(snapshot, (0, options_js_1.getTerminalWidth)(this.options.output, this.options));
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const line = (0, format_js_1.buildFinalLine)(snapshot, state, message, (0, options_js_1.getTerminalWidth)(this.options.output, this.options));
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    log(_bar, level, message) {
        this.options.output.write(`${level}: ${message}\n`);
        this.options.onRender?.(`${level}: ${message}`, undefined);
    }
    dispose() { }
}
class JsonRenderer {
    options;
    lastWriteAt = 0;
    constructor(options) {
        this.options = options;
    }
    register(bar) {
        this.update(bar, true);
    }
    update(bar, force = false) {
        const currentTime = (0, utils_js_1.now)();
        if (!force && currentTime - this.lastWriteAt < this.options.interval) {
            return;
        }
        this.lastWriteAt = currentTime;
        const snapshot = bar.snapshot();
        const line = (0, snapshot_js_1.safeJsonStringify)({ type: "progress", snapshot });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    finalize(bar, state, message, leave) {
        if (!leave) {
            return;
        }
        const snapshot = bar.snapshot();
        const line = (0, snapshot_js_1.safeJsonStringify)({ type: "final", state, message, snapshot });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, snapshot);
    }
    log(_bar, level, message) {
        const line = (0, snapshot_js_1.safeJsonStringify)({ type: "log", level, message });
        this.options.output.write(`${line}\n`);
        this.options.onRender?.(line, undefined);
    }
    dispose() { }
}
const terminalHubs = new WeakMap();
class TerminalHub {
    output;
    options;
    entries = new Map();
    renderedLineCount = 0;
    disposed = false;
    refCount = 0;
    lastRenderAt = 0;
    resizeHandler;
    constructor(output, options) {
        this.output = output;
        this.options = options;
        this.resizeHandler = () => {
            this.render(true);
        };
        if (typeof output.on === "function") {
            output.on("resize", this.resizeHandler);
        }
    }
    acquire() {
        this.refCount += 1;
    }
    release() {
        this.refCount = Math.max(0, this.refCount - 1);
        if (this.refCount === 0) {
            this.dispose();
            return true;
        }
        return false;
    }
    register(bar, options) {
        this.entries.set(bar.id, { bar, options });
        this.render(true);
    }
    update(force, options) {
        this.render(force, options.interval);
    }
    finalize(bar, state, message, leave, options) {
        this.entries.delete(bar.id);
        const width = (0, options_js_1.getTerminalWidth)(this.output, options);
        const line = (0, format_js_1.buildFinalLine)(bar.snapshot(), state, message, width);
        if (leave) {
            this.safeWriteLine(line, options);
        }
        else {
            this.render(true);
        }
    }
    log(level, message, options) {
        this.safeWriteLine(`${level}: ${message}`, options);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (typeof this.output.off === "function") {
            this.output.off("resize", this.resizeHandler);
        }
    }
    moveToLiveTop() {
        if (this.renderedLineCount <= 0) {
            return;
        }
        let frame = "\r";
        if (this.renderedLineCount > 1) {
            frame += `\u001B[${this.renderedLineCount - 1}A`;
        }
        this.output.write(frame);
    }
    deleteLiveRegion() {
        if (this.renderedLineCount <= 0) {
            return;
        }
        let frame = "\r";
        if (this.renderedLineCount > 1) {
            frame += `\u001B[${this.renderedLineCount - 1}A`;
        }
        frame += `\u001B[${this.renderedLineCount}M`;
        this.output.write(frame);
        this.renderedLineCount = 0;
    }
    safeWriteLine(line, options) {
        this.deleteLiveRegion();
        this.output.write(`${(0, utils_js_1.truncateDisplay)(line, (0, options_js_1.getTerminalWidth)(this.output, options))}\n`);
        this.render(true);
    }
    render(force, interval = this.options.interval) {
        if (this.disposed) {
            return;
        }
        const currentTime = (0, utils_js_1.now)();
        if (!force && currentTime - this.lastRenderAt < interval) {
            return;
        }
        this.lastRenderAt = currentTime;
        const bars = Array.from(this.entries.values()).filter(({ bar }) => !bar.closed);
        const lines = bars.map(({ bar, options }) => (0, format_js_1.buildLine)(bar.snapshot(), (0, options_js_1.getTerminalWidth)(this.output, options)));
        if (lines.length === 0) {
            this.deleteLiveRegion();
            return;
        }
        let frame = "";
        if (this.renderedLineCount > 0) {
            frame += "\r";
            if (this.renderedLineCount > 1) {
                frame += `\u001B[${this.renderedLineCount - 1}A`;
            }
        }
        const maximumLines = Math.max(this.renderedLineCount, lines.length);
        for (let index = 0; index < maximumLines; index += 1) {
            if (index < lines.length) {
                frame += `\r${lines[index]}\u001B[0K`;
            }
            else {
                frame += "\r\u001B[2K";
            }
            if (index < maximumLines - 1) {
                frame += "\n";
            }
        }
        if (lines.length < maximumLines) {
            frame += `\u001B[${maximumLines - lines.length}A`;
        }
        this.output.write(frame);
        this.renderedLineCount = lines.length;
    }
}
class TerminalRenderer {
    options;
    hub;
    disposed = false;
    constructor(options) {
        this.options = options;
        let hub = terminalHubs.get(options.output);
        if (!hub) {
            hub = new TerminalHub(options.output, options);
            terminalHubs.set(options.output, hub);
        }
        hub.acquire();
        this.hub = hub;
    }
    register(bar) {
        this.hub.register(bar, this.options);
    }
    update(_bar, force = false) {
        this.hub.update(force, this.options);
    }
    finalize(bar, state, message, leave) {
        this.hub.finalize(bar, state, message, leave, this.options);
    }
    log(_bar, level, message) {
        this.hub.log(level, message, this.options);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.hub.release()) {
            terminalHubs.delete(this.options.output);
        }
    }
}
function isCiEnvironment() {
    return (process.env.CI === "true" ||
        process.env.GITHUB_ACTIONS === "true" ||
        process.env.GITLAB_CI === "true" ||
        process.env.BITBUCKET_BUILD_NUMBER != null);
}
function createRenderer(options) {
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
