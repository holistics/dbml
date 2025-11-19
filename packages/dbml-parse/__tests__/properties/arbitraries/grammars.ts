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
  if (settings) parts.push(settings);
  return joinWithRandomSpaces(...parts);
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
  if (settings) parts.push(settings);
  return joinWithRandomSpaces(...parts);
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
