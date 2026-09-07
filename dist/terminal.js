import { truncateDisplay } from "./display.js";
import { buildFinalLine, buildLine } from "./layout.js";
import { getTerminalWidth } from "./options.js";
import { now } from "./utils.js";
export const terminalHubs = new WeakMap();
export class TerminalHub {
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
    register(bar) {
        this.entries.set(bar.id, bar);
        this.render(true);
    }
    update(bar, force = false) {
        this.render(force, bar.options.interval);
    }
    finalize(bar, state, message, leave) {
        this.entries.delete(bar.id);
        const width = getTerminalWidth(this.output, bar.options);
        const line = buildFinalLine(bar.snapshot(), state, message, width);
        if (leave) {
            this.safeWriteLine(line, bar.options);
        }
        else {
            this.render(true);
        }
    }
    log(bar, level, message) {
        this.safeWriteLine(`${level}: ${message}`, bar.options);
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
        this.output.write("\r");
        if (this.renderedLineCount > 1) {
            this.output.write(`\u001B[${this.renderedLineCount - 1}A`);
        }
    }
    deleteLiveRegion() {
        if (this.renderedLineCount <= 0) {
            return;
        }
        this.moveToLiveTop();
        this.output.write(`\u001B[${this.renderedLineCount}M`);
        this.renderedLineCount = 0;
    }
    safeWriteLine(line, options) {
        this.deleteLiveRegion();
        this.output.write(`${truncateDisplay(line, getTerminalWidth(this.output, options))}\n`);
        this.render(true);
    }
    render(force, interval = this.options.interval) {
        if (this.disposed) {
            return;
        }
        const currentTime = now();
        if (!force && currentTime - this.lastRenderAt < interval) {
            return;
        }
        this.lastRenderAt = currentTime;
        const bars = Array.from(this.entries.values()).filter((bar) => !bar.closed);
        const lines = bars.map((bar) => buildLine(bar.snapshot(), getTerminalWidth(this.output, bar.options)));
        if (lines.length === 0) {
            this.deleteLiveRegion();
            return;
        }
        this.moveToLiveTop();
        const maximumLines = Math.max(this.renderedLineCount, lines.length);
        for (let index = 0; index < maximumLines; index += 1) {
            this.output.write("\u001B[2K");
            if (index < lines.length) {
                this.output.write(lines[index]);
            }
            if (index < maximumLines - 1) {
                this.output.write("\n");
            }
        }
        if (lines.length < maximumLines) {
            this.output.write(`\u001B[${maximumLines - lines.length}A`);
        }
        this.renderedLineCount = lines.length;
    }
}
export class TerminalRenderer {
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
        this.hub.register(bar);
    }
    update(bar, force = false) {
        this.hub.update(bar, force);
    }
    finalize(bar, state, message, leave) {
        this.hub.finalize(bar, state, message, leave);
    }
    log(bar, level, message) {
        this.hub.log(bar, level, message);
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
