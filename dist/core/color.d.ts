import type { FlowbarColorMode, FlowbarColorName, WritableLike } from "../types.js";
export declare function isColorName(value: unknown): value is FlowbarColorName;
export declare function resolveColor(color: FlowbarColorMode | undefined, output: WritableLike): false | FlowbarColorName;
export declare function colorize(value: string, color: false | FlowbarColorName): string;
