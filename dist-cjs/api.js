"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.task = exports.group = exports.stream = exports.each = exports.map = exports.wait = exports.create = void 0;
exports.configure = configure;
const group_js_1 = require("./runtime/group.js");
const iterables_js_1 = require("./runtime/iterables.js");
const progress_bar_js_1 = require("./runtime/progress-bar.js");
const stream_js_1 = require("./runtime/stream.js");
const task_js_1 = require("./runtime/task.js");
exports.create = progress_bar_js_1.createProgressBar;
const wait = (options = {}) => (0, progress_bar_js_1.createProgressBar)({ ...options, mode: "indeterminate" });
exports.wait = wait;
exports.map = iterables_js_1.mapWithProgress;
exports.each = iterables_js_1.eachWithProgress;
exports.stream = stream_js_1.streamWithProgress;
exports.group = group_js_1.createGroup;
exports.task = task_js_1.task;
function configure(defaultOptions = {}) {
    return Object.freeze({
        create: (options = {}) => (0, progress_bar_js_1.createProgressBar)({ ...defaultOptions, ...options }),
        wait: (options = {}) => (0, progress_bar_js_1.createProgressBar)({ ...defaultOptions, ...options, mode: "indeterminate" }),
        map: (input, mapper, options = {}) => (0, iterables_js_1.mapWithProgress)(input, mapper, { ...defaultOptions, ...options }),
        each: (input, handler, options = {}) => (0, iterables_js_1.eachWithProgress)(input, handler, { ...defaultOptions, ...options }),
        stream: (options = {}) => (0, stream_js_1.streamWithProgress)({ ...defaultOptions, ...options }),
        group: (options = {}) => (0, group_js_1.createGroup)({ ...defaultOptions, ...options }),
        task: (label, handler, options = {}) => (0, task_js_1.task)(label, handler, { ...defaultOptions, ...options }),
        configure: (options = {}) => configure({ ...defaultOptions, ...options }),
    });
}
exports.default = iterables_js_1.flowbar;
