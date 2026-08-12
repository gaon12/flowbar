"use strict";

const api = require("./index.js");
const flowbar = api.default;

Object.assign(flowbar, api);
module.exports = flowbar;
