export const TABLE_CONSTRAINT_KIND = {
  FIELD: 'field',
  INDEX: 'index',
  FK: 'fk',
  UNIQUE: 'unique',
  PK: 'pk',
};

export const COLUMN_CONSTRAINT_KIND = {
  NOT_NULL: 'not_null',
  UNIQUE: 'unique',
  PK: 'pk',
  DEFAULT: 'dbdefault',
  INCREMENT: 'increment',
  INLINE_REF: 'inline_ref',
  NOTE: 'note',
};

export const DATA_TYPE = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  EXPRESSION: 'expression',
};

// legacy - for compatibility with model_structure
export const CONSTRAINT_TYPE = {
  COLUMN: 'column',
  STRING: 'string',
  EXPRESSION: 'expression',
};
