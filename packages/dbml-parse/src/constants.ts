import {
  Filepath,
} from '@/core/types/filepath';

export const KEYWORDS_OF_DEFAULT_SETTING = ['null', 'true', 'false'] as readonly string[];
export const DBML_EXT = '.dbml';
export const NUMERIC_LITERAL_PREFIX = ['-', '+'] as readonly string[];
export const DEFAULT_SCHEMA_NAME = 'public';
export const DEFAULT_ENTRY: Filepath = Filepath.from('/main.dbml');

export const ROOT = Filepath.from('/');
