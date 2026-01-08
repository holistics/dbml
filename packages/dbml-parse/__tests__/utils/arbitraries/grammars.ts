import fc from 'fast-check';
import {
  anyIdentifierArbitrary,
  singleLineStringArbitrary,
  multiLineStringArbitrary,
  anyStringArbitrary,
  numberArbitrary,
  functionExpressionArbitrary,
  colorArbitrary,
  identifierArbitrary,
} from './tokens';
import { caseVariant, settingKeyValue, joinWithRandomSpaces, joinWithRandomInlineSpaces, caseVariantOneOf } from './utils';

export const schemaQualifiedNameArbitrary = fc.tuple(anyIdentifierArbitrary, anyIdentifierArbitrary).map(([schema, name]) => `${schema}.${name}`);

// Basic type (just identifier)
export const basicTypeArbitrary = anyIdentifierArbitrary;

// Type arguments - can be numbers, identifiers, or arbitrary expressions
const typeArgArbitrary = fc.oneof(
  fc.integer({ min: 1, max: 1000 }).map(String),
  anyIdentifierArbitrary,
  fc.constant('MAX'),
);

// Type with arguments - supports 0 to many args
export const typeWithArgsArbitrary = fc.tuple(
  basicTypeArbitrary,
  fc.array(typeArgArbitrary, { minLength: 0, maxLength: 3 }),
).map(([type, args]) => {
  if (args.length === 0) {
    return `${type}()`;
  }
  return `${type}(${args.join(',')})`;
});

// Array type - can be applied to any type (basic, with args, or schema-qualified)
export const arrayTypeArbitrary = fc.oneof(
  basicTypeArbitrary.map((t) => `${t}[]`),
  typeWithArgsArbitrary.map((t) => `${t}[]`),
  schemaQualifiedNameArbitrary.map((t) => `${t}[]`),
);

// Any column type
export const columnTypeArbitrary = fc.oneof(
  basicTypeArbitrary,
  typeWithArgsArbitrary,
  arrayTypeArbitrary,
  schemaQualifiedNameArbitrary, // For enum types
);

// Note setting
export const noteSettingArbitrary = fc.oneof(
  settingKeyValue('note', singleLineStringArbitrary),
  settingKeyValue('note', multiLineStringArbitrary),
);

// Default value
export const defaultValueArbitrary = fc.oneof(
  settingKeyValue('default', numberArbitrary),
  settingKeyValue('default', singleLineStringArbitrary),
  settingKeyValue('default', caseVariant('true')),
  settingKeyValue('default', caseVariant('false')),
  settingKeyValue('default', caseVariant('null')),
  settingKeyValue('default', functionExpressionArbitrary),
);

// Check expressions (reuse function expression arbitrary since checks use backticks)
export const checkExpressionArbitrary = functionExpressionArbitrary;

// Inline check (for column settings): check: `expression`
export const inlineCheckArbitrary = checkExpressionArbitrary
  .map((expr) => `check: ${expr}`);

// Column settings (inside square brackets)
export const columnSettingArbitrary = fc.oneof(
  caseVariant('pk'),
  caseVariant('primary key'),
  caseVariant('null'),
  caseVariant('not null'),
  caseVariant('unique'),
  caseVariant('increment'),
  defaultValueArbitrary,
  noteSettingArbitrary,
  inlineCheckArbitrary,
);

export const columnSettingsListArbitrary = fc.array(columnSettingArbitrary, { minLength: 1, maxLength: 4 })
  .map((settings) => `[${settings.join(', ')}]`);

// Table settings
export const tableSettingArbitrary = fc.oneof(
  settingKeyValue('headercolor', colorArbitrary),
  noteSettingArbitrary,
);

export const tableSettingsListArbitrary = fc.array(tableSettingArbitrary, { minLength: 1, maxLength: 3 })
  .map((settings) => `[${settings.join(', ')}]`);

// Index settings
export const indexSettingArbitrary = fc.oneof(
  caseVariant('pk'),
  caseVariant('unique'),
  settingKeyValue('type', caseVariantOneOf('hash', 'btree', 'gin', 'gist')),
  settingKeyValue('name', anyIdentifierArbitrary),
  noteSettingArbitrary,
);

export const indexSettingsListArbitrary = fc.array(indexSettingArbitrary, { minLength: 1, maxLength: 3 })
  .map((settings) => `[${settings.join(', ')}]`);

// Ref settings
export const refSettingArbitrary = fc.oneof(
  settingKeyValue('name', anyIdentifierArbitrary),
  settingKeyValue('color', colorArbitrary),
  settingKeyValue('delete', fc.oneof(
    caseVariant('cascade'),
    caseVariant('restrict'),
    caseVariant('set null'),
    caseVariant('set default'),
    caseVariant('no action'),
  )),
  settingKeyValue('update', fc.oneof(
    caseVariant('cascade'),
    caseVariant('restrict'),
    caseVariant('set null'),
    caseVariant('set default'),
    caseVariant('no action'),
  )),
);

export const refSettingsListArbitrary = fc.array(refSettingArbitrary, { minLength: 1, maxLength: 4 })
  .map((settings) => `[${settings.join(', ')}]`);

// Simple column (name + type)
export const simpleColumnArbitrary = joinWithRandomInlineSpaces(
  anyIdentifierArbitrary,
  columnTypeArbitrary,
);

// Column with settings
export const columnWithSettingsArbitrary = joinWithRandomInlineSpaces(
  anyIdentifierArbitrary,
  columnTypeArbitrary,
  columnSettingsListArbitrary,
);

// Any column
export const columnArbitrary = fc.oneof(
  simpleColumnArbitrary,
  columnWithSettingsArbitrary,
);

// Column list (for table body)
export const columnListArbitrary = fc.array(columnArbitrary, { minLength: 1, maxLength: 8 })
  .map((cols) => cols.map((c) => `  ${c}`).join('\n'));

// Single column index
export const singleColumnIndexArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  fc.option(indexSettingsListArbitrary, { nil: undefined }),
).chain(([col, settings]) =>
  settings ? joinWithRandomInlineSpaces(col, settings) : fc.constant(col),
);

// Composite index
export const compositeIndexArbitrary = fc.tuple(
  fc.array(anyIdentifierArbitrary, { minLength: 2, maxLength: 4 }),
  fc.option(indexSettingsListArbitrary, { nil: undefined }),
).chain(([cols, settings]) => {
  const colList = `(${cols.join(', ')})`;
  return settings ? joinWithRandomInlineSpaces(colList, settings) : fc.constant(colList);
});

// Any index
export const indexArbitrary = fc.oneof(
  singleColumnIndexArbitrary,
  compositeIndexArbitrary,
);

// Indexes block
export const indexesBlockArbitrary = fc.tuple(
  caseVariant('Indexes'),
  fc.array(indexArbitrary, { minLength: 1, maxLength: 4 }),
).chain(([keyword, indexes]) =>
  joinWithRandomSpaces(keyword, '{').map((header) =>
    `  ${header}\n${indexes.map((idx) => `    ${idx}`).join('\n')}\n  }`,
  ),
);

// Check constraint settings (for checks block)
export const checkSettingArbitrary = settingKeyValue('name', anyIdentifierArbitrary);

// Check constraint (for checks block): `expression` [name: 'name']
export const checkConstraintArbitrary = fc.tuple(
  checkExpressionArbitrary,
  fc.option(checkSettingArbitrary, { nil: undefined }),
).chain(([expr, setting]) =>
  setting ? joinWithRandomInlineSpaces(expr, `[${setting}]`) : fc.constant(expr),
);

// Checks block (inside table body)
export const checksBlockArbitrary = fc.tuple(
  caseVariant('checks'),
  fc.array(checkConstraintArbitrary, { minLength: 1, maxLength: 3 }),
).chain(([keyword, checks]) =>
  joinWithRandomSpaces(keyword, '{').map((header) =>
    `  ${header}\n${checks.map((c) => `    ${c}`).join('\n')}\n  }`,
  ),
);

// Inline note in table/enum body
export const inlineNoteArbitrary = fc.tuple(
  caseVariant('Note'),
  anyStringArbitrary,
).chain(([keyword, s]) =>
  joinWithRandomSpaces(keyword, ':', s).map((line) => `  ${line}`),
);

// Block note in table body
export const blockNoteArbitrary = fc.tuple(
  caseVariant('Note'),
  anyStringArbitrary,
).chain(([keyword, s]) =>
  joinWithRandomSpaces(keyword, '{').map((header) =>
    `  ${header}\n    ${s}\n  }`,
  ),
);

// Simple enum value
export const simpleEnumValueArbitrary = anyIdentifierArbitrary.map((v) => `  ${v}`);

// Enum value with note
export const enumValueWithNoteArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  noteSettingArbitrary,
).chain(([value, note]) =>
  joinWithRandomInlineSpaces(value, `[${note}]`).map((line) => `  ${line}`),
);

// Any enum value
export const enumValueArbitrary = fc.oneof(
  simpleEnumValueArbitrary,
  enumValueWithNoteArbitrary,
);

// Enum declaration
export const enumArbitrary = fc.tuple(
  caseVariant('Enum'),
  anyIdentifierArbitrary,
  fc.array(enumValueArbitrary, { minLength: 1, maxLength: 6 }),
).chain(([keyword, name, values]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${values.join('\n')}\n}`,
  ),
);

// Relationship cardinality
export const relationshipTypeArbitrary = fc.constantFrom('<', '>', '-', '<>');

// Inline relationship (in column settings)
export const inlineRefArbitrary = fc.tuple(
  relationshipTypeArbitrary,
  schemaQualifiedNameArbitrary,
).chain(([rel, ref]) =>
  joinWithRandomInlineSpaces('ref:', rel, ref),
);

// Standalone ref with explicit columns
export const standaloneRefArbitrary = fc.tuple(
  caseVariant('Ref'),
  schemaQualifiedNameArbitrary,
  anyIdentifierArbitrary,
  relationshipTypeArbitrary,
  schemaQualifiedNameArbitrary,
  anyIdentifierArbitrary,
  fc.option(refSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, table1, col1, rel, table2, col2, settings]) => {
  const parts = [keyword, ':', `${table1}.${col1}`, rel, `${table2}.${col2}`];
  return settings ? joinWithRandomInlineSpaces(joinWithRandomSpaces(...parts), ' ', settings) : joinWithRandomSpaces(...parts);
});

// Named ref
export const namedRefArbitrary = fc.tuple(
  caseVariant('Ref'),
  anyIdentifierArbitrary,
  schemaQualifiedNameArbitrary,
  anyIdentifierArbitrary,
  relationshipTypeArbitrary,
  schemaQualifiedNameArbitrary,
  anyIdentifierArbitrary,
  fc.option(refSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, name, table1, col1, rel, table2, col2, settings]) => {
  const parts = [keyword, name, ':', `${table1}.${col1}`, rel, `${table2}.${col2}`];
  return settings ? joinWithRandomInlineSpaces(joinWithRandomSpaces(...parts), ' ', settings) : joinWithRandomSpaces(...parts);
});

// Multi-column ref
export const multiColumnRefArbitrary = fc.nat({ max: 10 }).chain((nendpoints) => fc.tuple(
  caseVariant('Ref'),
  schemaQualifiedNameArbitrary,
  fc.array(anyIdentifierArbitrary, { minLength: nendpoints, maxLength: nendpoints }),
  relationshipTypeArbitrary,
  schemaQualifiedNameArbitrary,
  fc.array(anyIdentifierArbitrary, { minLength: nendpoints, maxLength: nendpoints }),
  fc.option(refSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, table1, cols1, rel, table2, cols2, settings]) => {
  const parts = [keyword, ':', `${table1}.(${cols1.join(', ')})`, rel, `${table2}.(${cols2.join(', ')})`];
  return settings ? joinWithRandomInlineSpaces(joinWithRandomSpaces(...parts), ' ', settings) : joinWithRandomSpaces(...parts);
}));

// Any standalone ref
export const anyRefArbitrary = fc.oneof(
  standaloneRefArbitrary,
  namedRefArbitrary,
  multiColumnRefArbitrary,
);

// Simple table (name + columns only)
export const simpleTableArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  columnListArbitrary,
).chain(([keyword, name, cols]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${cols}\n}`,
  ),
);

// Table with settings
export const tableWithSettingsArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  tableSettingsListArbitrary,
  columnListArbitrary,
).chain(([keyword, name, settings, cols]) =>
  joinWithRandomSpaces(keyword, name, settings, '{').map((header) =>
    `${header}\n${cols}\n}`,
  ),
);

// Table with indexes
export const tableWithIndexesArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  columnListArbitrary,
  indexesBlockArbitrary,
).chain(([keyword, name, cols, indexes]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${cols}\n\n${indexes}\n}`,
  ),
);

// Table with note
export const tableWithNoteArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  columnListArbitrary,
  fc.oneof(inlineNoteArbitrary, blockNoteArbitrary),
).chain(([keyword, name, cols, note]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${cols}\n\n${note}\n}`,
  ),
);

// Table with everything
export const complexTableArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  fc.option(tableSettingsListArbitrary, { nil: undefined }),
  columnListArbitrary,
  fc.option(indexesBlockArbitrary, { nil: undefined }),
  fc.option(checksBlockArbitrary, { nil: undefined }),
  fc.option(fc.oneof(inlineNoteArbitrary, blockNoteArbitrary), { nil: undefined }),
).chain(([keyword, name, settings, cols, indexes, checks, note]) => {
  const headerParts = [keyword, name];
  if (settings) headerParts.push(settings);
  headerParts.push('{');

  return joinWithRandomSpaces(...headerParts).map((header) => {
    const parts = [cols];
    if (indexes) parts.push(indexes);
    if (checks) parts.push(checks);
    if (note) parts.push(note);
    return `${header}\n${parts.join('\n\n')}\n}`;
  });
});

// Any table
export const tableArbitrary = fc.oneof(
  simpleTableArbitrary,
  tableWithSettingsArbitrary,
  tableWithIndexesArbitrary,
  tableWithNoteArbitrary,
  complexTableArbitrary,
);

export const tableGroupArbitrary = fc.tuple(
  caseVariant('TableGroup'),
  fc.option(anyIdentifierArbitrary, { nil: undefined }),
  fc.array(anyIdentifierArbitrary, { minLength: 1, maxLength: 5 }),
  fc.option(tableSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, name, tables, settings]) => {
  const headerParts = [keyword];
  if (name) headerParts.push(name);
  if (settings) headerParts.push(settings);
  headerParts.push('{');

  return joinWithRandomSpaces(...headerParts).map((header) => {
    const tableRefs = tables.map((t) => `  ${t}`).join('\n');
    return `${header}\n${tableRefs}\n}`;
  });
});

export const tablePartialArbitrary = fc.tuple(
  caseVariant('TablePartial'),
  anyIdentifierArbitrary,
  columnListArbitrary,
  fc.option(indexesBlockArbitrary, { nil: undefined }),
  fc.option(checksBlockArbitrary, { nil: undefined }),
).chain(([keyword, name, cols, indexes, checks]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) => {
    const parts = [cols];
    if (indexes) parts.push(indexes);
    if (checks) parts.push(checks);
    return `${header}\n${parts.join('\n\n')}\n}`;
  }),
);

// Table partial injection (inside table body)
export const partialInjectionArbitrary = anyIdentifierArbitrary
  .chain((name) => joinWithRandomSpaces('~', name));

export const standaloneNoteArbitrary = fc.tuple(
  caseVariant('Note'),
  anyIdentifierArbitrary,
  anyStringArbitrary,
).chain(([keyword, name, content]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n  ${content}\n}`,
  ),
);

// Project setting
export const projectSettingArbitrary = fc.tuple(
  identifierArbitrary,
  fc.oneof(
    anyStringArbitrary,
    numberArbitrary,
    caseVariant('true'),
    caseVariant('false'),
  ),
).map(([key, value]) => `  ${key}: ${value}`);

export const projectArbitrary = fc.tuple(
  caseVariant('Project'),
  fc.option(anyIdentifierArbitrary, { nil: undefined }),
  fc.array(projectSettingArbitrary, { minLength: 0, maxLength: 5 }),
  fc.option(blockNoteArbitrary, { nil: undefined }),
).chain(([keyword, name, settings, note]) => {
  const headerParts = [keyword];
  if (name) headerParts.push(name);
  headerParts.push('{');

  return joinWithRandomSpaces(...headerParts).map((header) => {
    const parts = [];
    if (settings.length > 0) parts.push(settings.join('\n'));
    if (note) parts.push(note);
    return parts.length > 0 ? `${header}\n${parts.join('\n\n')}\n}` : `${header}\n}`;
  });
});

export const schemaElementArbitrary = fc.oneof(
  tableArbitrary,
  enumArbitrary,
  anyRefArbitrary,
  tableGroupArbitrary,
  standaloneNoteArbitrary,
  tablePartialArbitrary,
);

// Small schema (1-3 tables, 1-2 enums)
export const smallSchemaArbitrary = fc.tuple(
  fc.option(projectArbitrary, { nil: undefined }),
  fc.array(enumArbitrary, { minLength: 0, maxLength: 2 }),
  fc.array(tableArbitrary, { minLength: 1, maxLength: 3 }),
  fc.array(anyRefArbitrary, { minLength: 0, maxLength: 3 }),
).map(([project, enums, tables, refs]) => {
  const parts = [];
  if (project) parts.push(project);
  parts.push(...enums);
  parts.push(...tables);
  parts.push(...refs);
  return parts.join('\n\n');
});

// Medium schema (3-6 tables, 2-4 enums)
export const mediumSchemaArbitrary = fc.tuple(
  fc.option(projectArbitrary, { nil: undefined }),
  fc.array(enumArbitrary, { minLength: 1, maxLength: 4 }),
  fc.array(tableArbitrary, { minLength: 3, maxLength: 6 }),
  fc.array(anyRefArbitrary, { minLength: 2, maxLength: 6 }),
  fc.array(tableGroupArbitrary, { minLength: 0, maxLength: 2 }),
).map(([project, enums, tables, refs, groups]) => {
  const parts = [];
  if (project) parts.push(project);
  parts.push(...enums);
  parts.push(...tables);
  parts.push(...groups);
  parts.push(...refs);
  return parts.join('\n\n');
});

// Large schema (6-10 tables, complex relationships)
export const largeSchemaArbitrary = fc.tuple(
  fc.option(projectArbitrary, { nil: undefined }),
  fc.array(enumArbitrary, { minLength: 2, maxLength: 6 }),
  fc.array(complexTableArbitrary, { minLength: 6, maxLength: 10 }),
  fc.array(anyRefArbitrary, { minLength: 5, maxLength: 12 }),
  fc.array(tableGroupArbitrary, { minLength: 1, maxLength: 3 }),
  fc.array(standaloneNoteArbitrary, { minLength: 0, maxLength: 2 }),
).map(([project, enums, tables, refs, groups, notes]) => {
  const parts = [];
  if (project) parts.push(project);
  parts.push(...enums);
  parts.push(...tables);
  parts.push(...groups);
  parts.push(...refs);
  parts.push(...notes);
  return parts.join('\n\n');
});

// Any schema (weighted towards smaller schemas for testing)
export const dbmlSchemaArbitrary = fc.oneof(
  { weight: 5, arbitrary: smallSchemaArbitrary },
  { weight: 3, arbitrary: mediumSchemaArbitrary },
  { weight: 1, arbitrary: largeSchemaArbitrary },
);

// Malformed Input Arbitraries - generates syntactically invalid inputs

// Unclosed brackets/braces/parens
export const unclosedBracketArbitrary = fc.oneof(
  fc.nat({ max: 20 }).map((n) => '['.repeat(n + 1)), // more opens than closes
  fc.nat({ max: 20 }).map((n) => '{'.repeat(n + 1)),
  fc.nat({ max: 20 }).map((n) => '('.repeat(n + 1)),
  fc.nat({ max: 20 }).map((n) => ']'.repeat(n + 1)), // only closes
  fc.nat({ max: 20 }).map((n) => '}'.repeat(n + 1)),
  fc.nat({ max: 20 }).map((n) => ')'.repeat(n + 1)),
);

// Mismatched brackets
export const mismatchedBracketsArbitrary = fc.oneof(
  fc.constant('[}'),
  fc.constant('{]'),
  fc.constant('(}'),
  fc.constant('{)'),
  fc.constant('[)'),
  fc.constant('(]'),
  fc.nat({ max: 10 }).map((n) => '['.repeat(n) + '}'.repeat(n)),
  fc.nat({ max: 10 }).map((n) => '{'.repeat(n) + ']'.repeat(n)),
);

// Unclosed strings
export const unclosedStringArbitrary = fc.oneof(
  fc.string({ minLength: 0, maxLength: 50 }).map((s) => `'${s.replace(/'/g, '')}`), // missing closing '
  fc.string({ minLength: 0, maxLength: 50 }).map((s) => `"${s.replace(/"/g, '')}`), // missing closing "
  fc.string({ minLength: 0, maxLength: 50 }).map((s) => `'''${s.replace(/'''/g, '')}`), // missing closing '''
  fc.string({ minLength: 0, maxLength: 50 }).map((s) => `\`${s.replace(/`/g, '')}`), // missing closing `
);

// Truncated input mid-token
export const truncatedInputArbitrary = fc.tuple(
  tableArbitrary,
  fc.nat(),
).map(([source, cutPoint]) => {
  const point = cutPoint % Math.max(1, source.length);
  return source.slice(0, point);
});

// Invalid escape sequences
export const invalidEscapeArbitrary = fc.oneof(
  fc.constant("'\\x'"), // invalid escape
  fc.constant("'\\z'"),
  fc.constant("'\\9'"),
  fc.constant("'\\u'"), // incomplete unicode
  fc.constant("'\\u12'"), // incomplete unicode
  fc.constant("'\\'"), // trailing backslash
);

// Binary garbage (non-printable characters)
export const binaryGarbageArbitrary = fc.uint8Array({ minLength: 1, maxLength: 100 })
  .map((arr) => String.fromCharCode(...arr));

// Extremely deep nesting (>1000 levels)
export const extremeNestingArbitrary = fc.integer({ min: 500, max: 2000 })
  .map((depth) => '['.repeat(depth) + ']'.repeat(depth));

// Malformed table declarations
export const malformedTableArbitrary = fc.oneof(
  fc.constant('Table'), // missing name and body
  fc.constant('Table {'), // missing name
  fc.constant('Table users'), // missing body
  fc.constant('Table users {'), // unclosed
  fc.constant('Table { id int }'), // missing name
  anyIdentifierArbitrary.map((name) => `Table ${name} { id }`), // missing type
  anyIdentifierArbitrary.map((name) => `Table ${name} { int }`), // missing column name
  anyIdentifierArbitrary.map((name) => `Table ${name} { id int [`), // unclosed settings
);

// Malformed enum declarations
export const malformedEnumArbitrary = fc.oneof(
  fc.constant('Enum'), // missing name and body
  fc.constant('Enum {'), // missing name
  fc.constant('Enum status'), // missing body
  fc.constant('Enum status {'), // unclosed
  anyIdentifierArbitrary.map((name) => `Enum ${name} { [note: 'x' }`), // malformed value
);

// Malformed ref declarations
export const malformedRefArbitrary = fc.oneof(
  fc.constant('Ref'), // missing everything
  fc.constant('Ref:'), // missing endpoints
  fc.constant('Ref: users.id'), // missing second endpoint
  fc.constant('Ref: users.id >'), // missing second endpoint
  fc.constant('Ref: > orders.user_id'), // missing first endpoint
  fc.constant('Ref: users.id <> orders.user_id ['), // unclosed settings
);

// Columns with conflicting settings
export const conflictingSettingsArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
  columnTypeArbitrary,
  fc.constantFrom(
    '[pk, null]',
    '[pk, pk]',
    '[unique, unique]',
    '[not null, null]',
    '[increment, increment]',
    '[pk, not null, pk]',
    '[unique, null, unique]',
  ),
).map(([table, col, type, settings]) => `Table ${table} { ${col} ${type} ${settings} }`);

// Zero-column tables
export const emptyTableArbitrary = fc.oneof(
  fc.constant('Table empty {}'),
  fc.constant('Table empty { }'),
  fc.constant('Table empty {\n}'),
  fc.constant('Table empty {\n  \n}'),
);

// Column without settings (the common case that was undertested)
export const columnNoSettingsArbitrary = joinWithRandomInlineSpaces(
  anyIdentifierArbitrary,
  columnTypeArbitrary,
);

// Tables with zero or many settings
export const tableWithZeroSettingsArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  fc.array(columnNoSettingsArbitrary, { minLength: 1, maxLength: 5 }),
).chain(([keyword, name, cols]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${cols.map((c) => `  ${c}`).join('\n')}\n}`,
  ),
);

// All settings combined on one column
export const allSettingsColumnArbitrary = joinWithRandomInlineSpaces(
  anyIdentifierArbitrary,
  columnTypeArbitrary,
  fc.constant('[pk, unique, not null, increment, default: 0, note: \'test\']'),
);

// Self-referential table (e.g., users.manager_id > users.id)
export const selfReferentialTableArbitrary = anyIdentifierArbitrary.chain((tableName) =>
  fc.tuple(
    anyIdentifierArbitrary,
    anyIdentifierArbitrary,
  ).map(([fkCol, pkCol]) => `
Table ${tableName} {
  ${pkCol} int [pk]
  ${fkCol} int [ref: > ${tableName}.${pkCol}]
}
`));

// Circular references (variable length cycles: 2-5 tables)
export const circularRefArbitrary = fc.integer({ min: 2, max: 5 }).chain((count) =>
  fc.array(anyIdentifierArbitrary, { minLength: count, maxLength: count }).map((names) => {
    const tables = names.map((name, i) => {
      const nextName = names[(i + 1) % names.length];
      return `Table ${name} {\n  id int [pk]\n  ${nextName}_id int [ref: > ${nextName}.id]\n}`;
    });
    return tables.join('\n\n');
  }),
);

// References to non-existent tables/columns
export const danglingRefArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
  fc.constantFrom('nonexistent_table', 'nonexistent_col', 'both'),
).map(([table, col, fakeTable, fakeCol, mode]) => {
  const tableDecl = `Table ${table} { ${col} int [pk] }`;
  switch (mode) {
    case 'nonexistent_table':
      return `${tableDecl}\nRef: ${table}.${col} > ${fakeTable}.${col}`;
    case 'nonexistent_col':
      return `${tableDecl}\nRef: ${table}.${fakeCol} > ${table}.${col}`;
    default:
      return `Ref: ${fakeTable}.${fakeCol} > ${fakeTable}.${col}`;
  }
});

// Composite foreign keys with mismatched column counts
export const mismatchedCompositeRefArbitrary = fc.oneof(
  fc.constant('Ref: t1.(a, b) > t2.(c)'), // 2 vs 1
  fc.constant('Ref: t1.(a) > t2.(b, c)'), // 1 vs 2
  fc.constant('Ref: t1.(a, b, c) > t2.(d, e)'), // 3 vs 2
);

// Combined malformed arbitrary (for comprehensive fuzzing)
export const malformedInputArbitrary = fc.oneof(
  { weight: 2, arbitrary: unclosedBracketArbitrary },
  { weight: 2, arbitrary: mismatchedBracketsArbitrary },
  { weight: 2, arbitrary: unclosedStringArbitrary },
  { weight: 2, arbitrary: truncatedInputArbitrary },
  { weight: 1, arbitrary: invalidEscapeArbitrary },
  { weight: 1, arbitrary: binaryGarbageArbitrary },
  { weight: 1, arbitrary: extremeNestingArbitrary },
  { weight: 2, arbitrary: malformedTableArbitrary },
  { weight: 2, arbitrary: malformedEnumArbitrary },
  { weight: 2, arbitrary: malformedRefArbitrary },
  { weight: 1, arbitrary: conflictingSettingsArbitrary },
  { weight: 1, arbitrary: emptyTableArbitrary },
  { weight: 1, arbitrary: danglingRefArbitrary },
  { weight: 1, arbitrary: mismatchedCompositeRefArbitrary },
);

// Mutation arbitraries
export const charSubstitutionArbitrary = (source: string) => {
  if (source.length === 0) {
    return fc.string({ minLength: 1, maxLength: 1 });
  }
  return fc.tuple(
    fc.integer({ min: 0, max: source.length - 1 }),
    fc.string({ minLength: 1, maxLength: 1 }),
  ).map(([pos, char]) => source.slice(0, pos) + char + source.slice(pos + 1));
};

export const multiCharInsertionArbitrary = (source: string) =>
  fc.tuple(
    fc.nat({ max: source.length }),
    fc.string({ minLength: 1, maxLength: 10 }),
  ).map(([pos, chars]) => source.slice(0, pos) + chars + source.slice(pos));

export const blockDuplicationArbitrary = (source: string) =>
  fc.tuple(
    fc.nat({ max: Math.max(0, source.length - 1) }),
    fc.nat({ max: Math.max(0, source.length - 1) }),
  ).map(([start, end]) => {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const block = source.slice(s, e);
    return source.slice(0, e) + block + source.slice(e);
  });

// Convert a schema to use CRLF line endings (for Windows compatibility testing)
export const toCRLF = (source: string): string => source.replace(/\r?\n/g, '\r\n');

// Schema with CRLF line endings
export const crlfSchemaArbitrary = dbmlSchemaArbitrary.map(toCRLF);
