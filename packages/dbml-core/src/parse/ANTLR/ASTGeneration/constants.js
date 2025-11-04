export const TABLE_CONSTRAINT_KIND = {
  FIELD: 'table_field',
  INDEX: 'table_index',
  FK: 'table_fk',
  UNIQUE: 'table_unique',
  PK: 'table_pk',
  DEFAULT: 'table_default',
  CHECK: 'table_check',
};

export const COLUMN_CONSTRAINT_KIND = {
  NOT_NULL: 'col_not_null',
  NULLABLE: 'col_nullable',
  UNIQUE: 'col_unique',
  PK: 'col_pk',
  DEFAULT: 'col_dbdefault',
  INCREMENT: 'col_increment',
  INLINE_REF: 'col_inline_ref',
  NOTE: 'col_note',
  CHECK: 'col_check',
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
