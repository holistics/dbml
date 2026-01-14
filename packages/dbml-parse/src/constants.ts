export const KEYWORDS_OF_DEFAULT_SETTING = ['null', 'true', 'false'] as readonly string[];
export const NUMERIC_LITERAL_PREFIX = ['-', '+'] as readonly string[];
export const DEFAULT_SCHEMA_NAME = 'public';

// Ref relation operators
export enum RefRelation {
  ManyToOne = '>',
  OneToMany = '<',
  OneToOne = '-',
  ManyToMany = '<>',
}
