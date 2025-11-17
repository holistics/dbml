/**
 * Fast-check Arbitraries for DBML and Schema.rb
 *
 * This module provides fast-check arbitraries for generating valid DBML
 * and Ruby on Rails Schema.rb statements.
 */

import * as fc from 'fast-check';

/**
 * DBML Identifier
 */
export const dbmlIdentifier = (): fc.Arbitrary<string> => {
  return fc.oneof(
    // Simple identifiers
    fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,30}$/),
    // Quoted identifiers
    fc.stringMatching(/^[a-zA-Z0-9_\- ]{1,30}$/).map((s) => `"${s}"`),
  );
};

/**
 * DBML Data Types
 */
export const dbmlDataType = (): fc.Arbitrary<string> => {
  return fc.constantFrom(
    'int',
    'integer',
    'bigint',
    'smallint',
    'varchar',
    'varchar(255)',
    'text',
    'boolean',
    'bool',
    'date',
    'datetime',
    'timestamp',
    'timestamptz',
    'decimal',
    'decimal(10,2)',
    'float',
    'double',
    'json',
    'jsonb',
    'uuid',
    'blob',
    'bytea',
  );
};

/**
 * DBML Column Settings
 */
export interface DbmlColumnSettings {
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  increment?: boolean;
  default?: string;
  note?: string;
}

export const dbmlColumnSettings = (): fc.Arbitrary<DbmlColumnSettings> => {
  return fc.record({
    primaryKey: fc.boolean(),
    notNull: fc.boolean(),
    unique: fc.boolean(),
    increment: fc.boolean(),
    default: fc.option(
      fc.oneof(
        fc.constantFrom('null', '0', '1', 'true', 'false', 'now()', '\'default\''),
        fc.integer().map((n) => n.toString()),
        fc.stringMatching(/^'[a-zA-Z0-9 ]{1,20}'$/),
      ),
      { nil: undefined },
    ),
    note: fc.option(
      fc.stringMatching(/^[a-zA-Z0-9 .,!?]{1,100}$/).map((s) => `'${s}'`),
      { nil: undefined },
    ),
  });
};

/**
 * Format DBML column settings
 */
export function formatDbmlColumnSettings (settings: DbmlColumnSettings): string {
  const parts: string[] = [];

  if (settings.primaryKey) parts.push('pk');
  if (settings.notNull) parts.push('not null');
  if (settings.unique) parts.push('unique');
  if (settings.increment) parts.push('increment');
  if (settings.default !== undefined) parts.push(`default: ${settings.default}`);
  if (settings.note !== undefined) parts.push(`note: ${settings.note}`);

  return parts.length > 0 ? `[${parts.join(', ')}]` : '';
}

/**
 * DBML Column Definition
 */
export interface DbmlColumn {
  name: string;
  type: string;
  settings: DbmlColumnSettings;
}

export const dbmlColumn = (): fc.Arbitrary<DbmlColumn> => {
  return fc.record({
    name: dbmlIdentifier(),
    type: dbmlDataType(),
    settings: dbmlColumnSettings(),
  });
};

/**
 * Format DBML column
 */
export function formatDbmlColumn (col: DbmlColumn): string {
  const settingsStr = formatDbmlColumnSettings(col.settings);
  return `  ${col.name} ${col.type}${settingsStr ? ' ' + settingsStr : ''}`;
}

/**
 * DBML Index Definition
 */
export interface DbmlIndex {
  columns: string[];
  settings?: {
    unique?: boolean;
    type?: string;
    name?: string;
  };
}

export const dbmlIndex = (): fc.Arbitrary<DbmlIndex> => {
  return fc.record({
    columns: fc.array(dbmlIdentifier(), { minLength: 1, maxLength: 3 }),
    settings: fc.option(
      fc.record({
        unique: fc.boolean(),
        type: fc.option(fc.constantFrom('btree', 'hash', 'gin', 'gist'), { nil: undefined }),
        name: fc.option(dbmlIdentifier(), { nil: undefined }),
      }),
      { nil: undefined },
    ),
  });
};

/**
 * Format DBML index
 */
export function formatDbmlIndex (idx: DbmlIndex): string {
  const columnList = `(${idx.columns.join(', ')})`;
  const settings: string[] = [];

  if (idx.settings) {
    if (idx.settings.unique) settings.push('unique');
    if (idx.settings.type) settings.push(`type: ${idx.settings.type}`);
    if (idx.settings.name) settings.push(`name: ${idx.settings.name}`);
  }

  const settingsStr = settings.length > 0 ? ` [${settings.join(', ')}]` : '';
  return `  ${columnList}${settingsStr}`;
}

/**
 * DBML Table Definition
 */
export interface DbmlTable {
  name: string;
  schema?: string;
  columns: DbmlColumn[];
  indexes?: DbmlIndex[];
  note?: string;
}

export const dbmlTable = (): fc.Arbitrary<DbmlTable> => {
  return fc.record({
    name: dbmlIdentifier(),
    schema: fc.option(dbmlIdentifier(), { nil: undefined }),
    columns: fc.array(dbmlColumn(), { minLength: 1, maxLength: 10 }),
    indexes: fc.option(fc.array(dbmlIndex(), { maxLength: 5 }), { nil: undefined }),
    note: fc.option(
      fc.stringMatching(/^[a-zA-Z0-9 .,!?\n]{1,200}$/).map((s) => `'${s}'`),
      { nil: undefined },
    ),
  });
};

/**
 * Format DBML table
 */
export function formatDbmlTable (table: DbmlTable): string {
  const fullName = table.schema ? `${table.schema}.${table.name}` : table.name;
  const lines: string[] = [`Table ${fullName} {`];

  // Columns
  lines.push(...table.columns.map(formatDbmlColumn));

  // Indexes
  if (table.indexes && table.indexes.length > 0) {
    lines.push('');
    lines.push('  indexes {');
    lines.push(...table.indexes.map((idx) => '  ' + formatDbmlIndex(idx)));
    lines.push('  }');
  }

  // Note
  if (table.note) {
    lines.push('');
    lines.push(`  Note: ${table.note}`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * DBML Relationship
 */
export interface DbmlRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: '1-1' | '1-*' | '*-1' | '*-*';
  onDelete?: string;
  onUpdate?: string;
}

export const dbmlRelationship = (): fc.Arbitrary<DbmlRelationship> => {
  return fc.record({
    fromTable: dbmlIdentifier(),
    fromColumn: dbmlIdentifier(),
    toTable: dbmlIdentifier(),
    toColumn: dbmlIdentifier(),
    type: fc.constantFrom('1-1', '1-*', '*-1', '*-*'),
    onDelete: fc.option(fc.constantFrom('cascade', 'restrict', 'set null', 'no action'), { nil: undefined }),
    onUpdate: fc.option(fc.constantFrom('cascade', 'restrict', 'set null', 'no action'), { nil: undefined }),
  });
};

/**
 * Convert DBML relationship type to ref syntax
 */
function getRefSyntax (type: string): { left: string; right: string } {
  switch (type) {
    case '1-1':
      return { left: '-', right: '-' };
    case '1-*':
      return { left: '<', right: '-' };
    case '*-1':
      return { left: '-', right: '>' };
    case '*-*':
      return { left: '<', right: '>' };
    default:
      return { left: '-', right: '-' };
  }
}

/**
 * Format DBML relationship
 */
export function formatDbmlRelationship (rel: DbmlRelationship): string {
  const { left, right } = getRefSyntax(rel.type);
  let ref = `Ref: ${rel.fromTable}.${rel.fromColumn} ${left}${right} ${rel.toTable}.${rel.toColumn}`;

  const settings: string[] = [];
  if (rel.onDelete) settings.push(`ondelete: ${rel.onDelete}`);
  if (rel.onUpdate) settings.push(`onupdate: ${rel.onUpdate}`);

  if (settings.length > 0) {
    ref += ` [${settings.join(', ')}]`;
  }

  return ref;
}

/**
 * DBML Enum
 */
export interface DbmlEnum {
  name: string;
  values: Array<{ name: string; note?: string }>;
}

export const dbmlEnum = (): fc.Arbitrary<DbmlEnum> => {
  return fc.record({
    name: dbmlIdentifier(),
    values: fc.array(
      fc.record({
        name: dbmlIdentifier(),
        note: fc.option(
          fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/).map((s) => `'${s}'`),
          { nil: undefined },
        ),
      }),
      { minLength: 1, maxLength: 10 },
    ),
  });
};

/**
 * Format DBML enum
 */
export function formatDbmlEnum (enumDef: DbmlEnum): string {
  const lines: string[] = [`Enum ${enumDef.name} {`];

  for (const value of enumDef.values) {
    const noteStr = value.note ? ` [note: ${value.note}]` : '';
    lines.push(`  ${value.name}${noteStr}`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Complete DBML Schema
 */
export interface DbmlSchema {
  project?: {
    name: string;
    note?: string;
  };
  enums?: DbmlEnum[];
  tables: DbmlTable[];
  relationships?: DbmlRelationship[];
}

export const dbmlSchema = (): fc.Arbitrary<DbmlSchema> => {
  return fc.record({
    project: fc.option(
      fc.record({
        name: dbmlIdentifier(),
        note: fc.option(
          fc.stringMatching(/^[a-zA-Z0-9 .,!?\n]{1,200}$/).map((s) => `'${s}'`),
          { nil: undefined },
        ),
      }),
      { nil: undefined },
    ),
    enums: fc.option(fc.array(dbmlEnum(), { maxLength: 5 }), { nil: undefined }),
    tables: fc.array(dbmlTable(), { minLength: 1, maxLength: 5 }),
    relationships: fc.option(fc.array(dbmlRelationship(), { maxLength: 5 }), { nil: undefined }),
  });
};

/**
 * Format complete DBML schema
 */
export function formatDbmlSchema (schema: DbmlSchema): string {
  const parts: string[] = [];

  // Project
  if (schema.project) {
    const lines = [`Project ${schema.project.name} {`];
    if (schema.project.note) {
      lines.push(`  Note: ${schema.project.note}`);
    }
    lines.push('}');
    parts.push(lines.join('\n'));
  }

  // Enums
  if (schema.enums && schema.enums.length > 0) {
    parts.push(...schema.enums.map(formatDbmlEnum));
  }

  // Tables
  parts.push(...schema.tables.map(formatDbmlTable));

  // Relationships
  if (schema.relationships && schema.relationships.length > 0) {
    parts.push(...schema.relationships.map(formatDbmlRelationship));
  }

  return parts.join('\n\n');
}

/**
 * Schema.rb Arbitraries
 */

/**
 * Rails column type
 */
export const railsColumnType = (): fc.Arbitrary<string> => {
  return fc.constantFrom(
    'integer',
    'bigint',
    'string',
    'text',
    'boolean',
    'date',
    'datetime',
    'timestamp',
    'decimal',
    'float',
    'binary',
    'json',
    'jsonb',
    'uuid',
  );
};

/**
 * Rails column options
 */
export interface RailsColumnOptions {
  null?: boolean;
  default?: string;
  limit?: number;
  precision?: number;
  scale?: number;
}

export const railsColumnOptions = (): fc.Arbitrary<RailsColumnOptions> => {
  return fc.record({
    null: fc.boolean(),
    default: fc.option(
      fc.oneof(
        fc.constantFrom('nil', '0', '1', 'true', 'false', '""'),
        fc.integer({ min: 0, max: 100 }).map((n) => n.toString()),
      ),
      { nil: undefined },
    ),
    limit: fc.option(fc.integer({ min: 1, max: 255 }), { nil: undefined }),
    precision: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
    scale: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
  });
};

/**
 * Format Rails column options
 */
export function formatRailsOptions (options: RailsColumnOptions): string {
  const parts: string[] = [];

  if (options.null !== undefined) parts.push(`null: ${options.null}`);
  if (options.default !== undefined) parts.push(`default: ${options.default}`);
  if (options.limit !== undefined) parts.push(`limit: ${options.limit}`);
  if (options.precision !== undefined) parts.push(`precision: ${options.precision}`);
  if (options.scale !== undefined) parts.push(`scale: ${options.scale}`);

  return parts.length > 0 ? `, ${parts.join(', ')}` : '';
}

/**
 * Rails table definition
 */
export interface RailsTable {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    options: RailsColumnOptions;
  }>;
  indexes?: Array<{
    columns: string[];
    unique?: boolean;
  }>;
}

export const railsTable = (): fc.Arbitrary<RailsTable> => {
  return fc.record({
    name: fc.stringMatching(/^[a-z_][a-z0-9_]{0,30}$/),
    columns: fc.array(
      fc.record({
        name: fc.stringMatching(/^[a-z_][a-z0-9_]{0,30}$/),
        type: railsColumnType(),
        options: railsColumnOptions(),
      }),
      { minLength: 1, maxLength: 10 },
    ),
    indexes: fc.option(
      fc.array(
        fc.record({
          columns: fc.array(fc.stringMatching(/^[a-z_][a-z0-9_]{0,30}$/), { minLength: 1, maxLength: 3 }),
          unique: fc.boolean(),
        }),
        { maxLength: 5 },
      ),
      { nil: undefined },
    ),
  });
};

/**
 * Format Rails table
 */
export function formatRailsTable (table: RailsTable): string {
  const lines: string[] = [`  create_table :${table.name} do |t|`];

  // Columns
  for (const col of table.columns) {
    const optionsStr = formatRailsOptions(col.options);
    lines.push(`    t.${col.type} :${col.name}${optionsStr}`);
  }

  lines.push('  end');

  // Indexes
  if (table.indexes && table.indexes.length > 0) {
    for (const idx of table.indexes) {
      const uniqueStr = idx.unique ? ', unique: true' : '';
      const colArray = idx.columns.length === 1 ? `:${idx.columns[0]}` : `[${idx.columns.map((c) => `:${c}`).join(', ')}]`;
      lines.push(`  add_index :${table.name}, ${colArray}${uniqueStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Complete Schema.rb file
 */
export interface SchemaRbFile {
  version: string;
  tables: RailsTable[];
}

export const schemaRbFile = (): fc.Arbitrary<SchemaRbFile> => {
  return fc.record({
    version: fc.integer({ min: 20200101000000, max: 20251231235959 }).map((n) => n.toString()),
    tables: fc.array(railsTable(), { minLength: 1, maxLength: 5 }),
  });
};

/**
 * Format complete Schema.rb file
 */
export function formatSchemaRb (schema: SchemaRbFile): string {
  const lines: string[] = [
    'ActiveRecord::Schema.define(version: ' + schema.version + ') do',
    '',
  ];

  lines.push(...schema.tables.map(formatRailsTable));
  lines.push('');
  lines.push('end');

  return lines.join('\n');
}

/**
 * Malformed DBML (for fuzzing tests)
 */
export const malformedDbml = (): fc.Arbitrary<string> => {
  return fc.oneof(
    // Random strings
    fc.string({ minLength: 0, maxLength: 1000 }),
    // Incomplete statements
    fc.constantFrom(
      'Table users {',
      'Ref:',
      'Enum',
      'Project {',
    ),
    // Invalid syntax
    fc.constantFrom(
      'Table "unclosed',
      'Ref: . -> .',
      'Enum { }',
      'Table [] {}',
    ),
    // Mixed valid and invalid
    fc.tuple(dbmlTable(), fc.string()).map(([table, noise]) =>
      `${formatDbmlTable(table)} ${noise}`,
    ),
  );
};
