import { Filepath } from '@/core/types/filepath';

export const KEYWORDS_OF_DEFAULT_SETTING = ['null', 'true', 'false'] as readonly string[];
export const NUMERIC_LITERAL_PREFIX = ['-', '+'] as readonly string[];
export const DEFAULT_SCHEMA_NAME = 'public';

export const PASS_THROUGH = Symbol('PASS_THROUGH');
export type PassThrough = typeof PASS_THROUGH;

export const UNHANDLED = Symbol('UNHANDLED');
export type Unhandled = typeof UNHANDLED;

export const ROOT = Filepath.from('/');
export const DEFAULT_ENTRY = Filepath.from('/main.dbml');

export const DBML_EXT = '.dbml';
