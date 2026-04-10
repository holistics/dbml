export const KEYWORDS_OF_DEFAULT_SETTING = ['null', 'true', 'false'] as readonly string[];
export const NUMERIC_LITERAL_PREFIX = ['-', '+'] as readonly string[];
export const DEFAULT_SCHEMA_NAME = 'public';
export const DBML_EXT = '.dbml';
export const DEFAULT_ENTRY = 'main.dbml';

export const PASS_THROUGH = Symbol('PASS_THROUGH');
export type PassThrough = typeof PASS_THROUGH;

export const UNHANDLED = Symbol('UNHANDLED');
export type Unhandled = typeof UNHANDLED;
