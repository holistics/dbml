import fc from 'fast-check';
import {
  anyIdentifierArbitrary,
  singleLineStringArbitrary,
  multiLineStringArbitrary,
  anyStringArbitrary,
  numberArbitrary,
  prefixedNumberArbitrary,
  functionExpressionArbitrary,
  colorArbitrary,
  identifierArbitrary,
  commentArbitrary,
  singleLineCommentArbitrary,
} from './tokens';
import { caseVariant, settingKeyValue, joinWithRandomSpaces, joinWithRandomInlineSpaces, caseVariantOneOf } from './utils';

// Helper to optionally inject a comment before content
const maybeWithComment = (contentArb: fc.Arbitrary<string>): fc.Arbitrary<string> =>
  fc.tuple(
    fc.option(commentArbitrary, { nil: undefined }),
    contentArb,
  ).map(([comment, content]) => comment ? `${comment}${content}` : content);

// Whitespace variations for joining
export const whitespaceArbitrary = fc.oneof(
  fc.constant(' '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('  '),
  fc.constant('\n\n'),
  fc.constant(' \t '),
  fc.constant('\r\n'), // CRLF
);

// Schema-qualified name: schema.name
export const schemaQualifiedNameArbitrary = fc.tuple(anyIdentifierArbitrary, anyIdentifierArbitrary).map(([schema, name]) => `${schema}.${name}`);

// Any table/element name - can be simple identifier or schema-qualified
export const anyElementNameArbitrary = fc.oneof(
  { weight: 3, arbitrary: anyIdentifierArbitrary },
  { weight: 1, arbitrary: schemaQualifiedNameArbitrary },
);

// Ref endpoint: can be table.column or schema.table.column
export const simpleRefEndpointArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
).map(([table, col]) => `${table}.${col}`);

export const schemaQualifiedRefEndpointArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
).map(([schema, table, col]) => `${schema}.${table}.${col}`);

export const anyRefEndpointArbitrary = fc.oneof(
  { weight: 3, arbitrary: simpleRefEndpointArbitrary },
  { weight: 1, arbitrary: schemaQualifiedRefEndpointArbitrary },
);

// Basic type - any valid identifier (types are not validated by parser)
export const basicTypeArbitrary = anyIdentifierArbitrary;

// Type arguments - can be numbers, identifiers, or quoted strings
const typeArgArbitrary = fc.oneof(
  fc.integer({ min: 0, max: 65535 }).map(String), // Wide range of integers
  fc.tuple(fc.integer({ min: 1, max: 38 }), fc.integer({ min: 0, max: 30 })).map(([p, s]) => `${p}, ${s}`), // Precision/scale pairs
  anyIdentifierArbitrary,
  singleLineStringArbitrary, // For charset args like 'utf8'
);

// Type with arguments - supports 0 to many args: varchar(255), decimal(10,2)
export const typeWithArgsArbitrary = fc.tuple(
  basicTypeArbitrary,
  fc.array(typeArgArbitrary, { minLength: 1, maxLength: 3 }),
).map(([type, args]) => `${type}(${args.join(', ')})`);

// Type with empty parens: type()
export const typeWithEmptyArgsArbitrary = basicTypeArbitrary.map((t) => `${t}()`);

// Array type - can be applied to any type: int[], varchar(255)[]
export const arrayTypeArbitrary = fc.oneof(
  basicTypeArbitrary.map((t) => `${t}[]`),
  typeWithArgsArbitrary.map((t) => `${t}[]`),
  schemaQualifiedNameArbitrary.map((t) => `${t}[]`),
);

// Array with size: int[5], varchar[255]
export const sizedArrayTypeArbitrary = fc.tuple(
  basicTypeArbitrary,
  fc.integer({ min: 1, max: 255 }),
).map(([type, size]) => `${type}[${size}]`);

// Schema-qualified type: schema.custom_type, public.my_enum
export const schemaQualifiedTypeArbitrary = schemaQualifiedNameArbitrary;

// Any column type with realistic distribution
export const columnTypeArbitrary = fc.oneof(
  { weight: 5, arbitrary: basicTypeArbitrary },
  { weight: 3, arbitrary: typeWithArgsArbitrary },
  { weight: 1, arbitrary: typeWithEmptyArgsArbitrary },
  { weight: 2, arbitrary: arrayTypeArbitrary },
  { weight: 1, arbitrary: sizedArrayTypeArbitrary },
  { weight: 2, arbitrary: schemaQualifiedTypeArbitrary },
);

// Note setting
export const noteSettingArbitrary = fc.oneof(
  settingKeyValue('note', singleLineStringArbitrary),
  settingKeyValue('note', multiLineStringArbitrary),
);

// Enum member reference for default values (e.g., status.active)
export const enumMemberArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
).map(([enumName, member]) => `${enumName}.${member}`);

// Any numeric default (plain or prefixed)
const numericDefaultArbitrary = fc.oneof(
  numberArbitrary,
  prefixedNumberArbitrary, // +10, -45, -3.14
);

// Default value - supports all valid formats
export const defaultValueArbitrary = fc.oneof(
  settingKeyValue('default', numericDefaultArbitrary),
  settingKeyValue('default', singleLineStringArbitrary),
  settingKeyValue('default', caseVariant('true')),
  settingKeyValue('default', caseVariant('false')),
  settingKeyValue('default', caseVariant('null')),
  settingKeyValue('default', functionExpressionArbitrary),
  settingKeyValue('default', enumMemberArbitrary), // enum member reference
);

// Check expressions (reuse function expression arbitrary since checks use backticks)
export const checkExpressionArbitrary = functionExpressionArbitrary;

// Inline check (for column settings): check: `expression`
export const inlineCheckArbitrary = checkExpressionArbitrary
  .map((expr) => `check: ${expr}`);

// Relationship cardinality operators
export const relationshipTypeArbitrary = fc.constantFrom('<', '>', '-', '<>');

// Inline ref setting for columns: ref: > table.column or ref: < schema.table.column
export const inlineRefSettingArbitrary = fc.tuple(
  relationshipTypeArbitrary,
  anyRefEndpointArbitrary,
).map(([rel, endpoint]) => `ref: ${rel} ${endpoint}`);

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
  inlineRefSettingArbitrary,
);

// Column settings list - supports 0 to many settings for broader coverage
export const columnSettingsListArbitrary = fc.array(columnSettingArbitrary, { minLength: 1, maxLength: 8 })
  .map((settings) => `[${settings.join(', ')}]`);

// Empty settings list []
export const emptySettingsListArbitrary = fc.constant('[]');

// Table settings (only headercolor and note are valid for tables)
export const tableSettingArbitrary = fc.oneof(
  settingKeyValue('headercolor', colorArbitrary),
  noteSettingArbitrary,
);

export const tableSettingsListArbitrary = fc.array(tableSettingArbitrary, { minLength: 1, maxLength: 3 })
  .map((settings) => `[${settings.join(', ')}]`);

// Index settings (type only supports btree and hash, name must be string literal)
export const indexSettingArbitrary = fc.oneof(
  caseVariant('pk'),
  caseVariant('unique'),
  settingKeyValue('type', caseVariantOneOf('btree', 'hash')),
  settingKeyValue('name', singleLineStringArbitrary), // name must be string literal
  noteSettingArbitrary,
);

export const indexSettingsListArbitrary = fc.array(indexSettingArbitrary, { minLength: 1, maxLength: 3 })
  .map((settings) => `[${settings.join(', ')}]`);

// Ref field settings (only delete, update, color are valid - no name setting)
export const refSettingArbitrary = fc.oneof(
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

// Column list (for table body) - increased bounds, optionally with comments
export const columnListArbitrary = fc.array(
  maybeWithComment(columnArbitrary),
  { minLength: 1, maxLength: 15 },
).map((cols) => cols.map((c) => `  ${c}`).join('\n'));

// Single column index
export const singleColumnIndexArbitrary = fc.tuple(
  anyIdentifierArbitrary,
  fc.option(indexSettingsListArbitrary, { nil: undefined }),
).chain(([col, settings]) =>
  settings ? joinWithRandomInlineSpaces(col, settings) : fc.constant(col),
);

// Expression index (e.g., `lower(email)`)
export const expressionIndexArbitrary = fc.tuple(
  functionExpressionArbitrary,
  fc.option(indexSettingsListArbitrary, { nil: undefined }),
).chain(([expr, settings]) =>
  settings ? joinWithRandomInlineSpaces(expr, settings) : fc.constant(expr),
);

// Composite index with columns
export const compositeIndexArbitrary = fc.tuple(
  fc.array(anyIdentifierArbitrary, { minLength: 2, maxLength: 4 }),
  fc.option(indexSettingsListArbitrary, { nil: undefined }),
).chain(([cols, settings]) => {
  const colList = `(${cols.join(', ')})`;
  return settings ? joinWithRandomInlineSpaces(colList, settings) : fc.constant(colList);
});

// Composite index with mixed columns and expressions
export const mixedCompositeIndexArbitrary = fc.tuple(
  fc.array(
    fc.oneof(anyIdentifierArbitrary, functionExpressionArbitrary),
    { minLength: 2, maxLength: 4 },
  ),
  fc.option(indexSettingsListArbitrary, { nil: undefined }),
).chain(([items, settings]) => {
  const itemList = `(${items.join(', ')})`;
  return settings ? joinWithRandomInlineSpaces(itemList, settings) : fc.constant(itemList);
});

// Any index
export const indexArbitrary = fc.oneof(
  { weight: 3, arbitrary: singleColumnIndexArbitrary },
  { weight: 1, arbitrary: expressionIndexArbitrary },
  { weight: 2, arbitrary: compositeIndexArbitrary },
  { weight: 1, arbitrary: mixedCompositeIndexArbitrary },
);

// Indexes block
// Indexes block - increased bounds for more coverage
export const indexesBlockArbitrary = fc.tuple(
  caseVariant('Indexes'),
  fc.array(maybeWithComment(indexArbitrary), { minLength: 1, maxLength: 10 }),
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

// Enum declaration (supports schema-qualified names like schema.status) - increased bounds
export const enumArbitrary = fc.tuple(
  caseVariant('Enum'),
  anyElementNameArbitrary, // Can be schema.enum or just enum
  fc.array(maybeWithComment(enumValueArbitrary), { minLength: 1, maxLength: 20 }),
).chain(([keyword, name, values]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${values.join('\n')}\n}`,
  ),
);

// Inline relationship (in column settings) - DEPRECATED: use inlineRefSettingArbitrary instead
export const inlineRefArbitrary = fc.tuple(
  relationshipTypeArbitrary,
  schemaQualifiedNameArbitrary,
).chain(([rel, ref]) =>
  joinWithRandomInlineSpaces('ref:', rel, ref),
);

// Standalone ref with explicit columns (uses flexible endpoints)
export const standaloneRefArbitrary = fc.tuple(
  caseVariant('Ref'),
  anyRefEndpointArbitrary, // table.col or schema.table.col
  relationshipTypeArbitrary,
  anyRefEndpointArbitrary,
  fc.option(refSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, endpoint1, rel, endpoint2, settings]) => {
  const parts = [keyword, ':', endpoint1, rel, endpoint2];
  return settings
    ? joinWithRandomSpaces(...parts).map((s) => s.trimEnd()).chain((base) => joinWithRandomInlineSpaces(base, settings))
    : joinWithRandomSpaces(...parts);
});

// Named ref
export const namedRefArbitrary = fc.tuple(
  caseVariant('Ref'),
  anyIdentifierArbitrary, // ref name
  anyRefEndpointArbitrary,
  relationshipTypeArbitrary,
  anyRefEndpointArbitrary,
  fc.option(refSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, name, endpoint1, rel, endpoint2, settings]) => {
  const parts = [keyword, name, ':', endpoint1, rel, endpoint2];
  return settings
    ? joinWithRandomSpaces(...parts).map((s) => s.trimEnd()).chain((base) => joinWithRandomInlineSpaces(base, settings))
    : joinWithRandomSpaces(...parts);
});

// Multi-column ref (composite keys) - increased column count bounds
export const multiColumnRefArbitrary = fc.integer({ min: 2, max: 10 }).chain((nendpoints) => fc.tuple(
  caseVariant('Ref'),
  anyElementNameArbitrary, // table or schema.table
  fc.array(anyIdentifierArbitrary, { minLength: nendpoints, maxLength: nendpoints }),
  relationshipTypeArbitrary,
  anyElementNameArbitrary,
  fc.array(anyIdentifierArbitrary, { minLength: nendpoints, maxLength: nendpoints }),
  fc.option(refSettingsListArbitrary, { nil: undefined }),
).chain(([keyword, table1, cols1, rel, table2, cols2, settings]) => {
  const parts = [keyword, ':', `${table1}.(${cols1.join(', ')})`, rel, `${table2}.(${cols2.join(', ')})`];
  return settings
    ? joinWithRandomSpaces(...parts).map((s) => s.trimEnd()).chain((base) => joinWithRandomInlineSpaces(base, settings))
    : joinWithRandomSpaces(...parts);
}));

// Any standalone ref
export const anyRefArbitrary = fc.oneof(
  standaloneRefArbitrary,
  namedRefArbitrary,
  multiColumnRefArbitrary,
);

// Table alias: as aliasName
export const tableAliasArbitrary = fc.tuple(
  caseVariant('as'),
  anyIdentifierArbitrary,
).chain(([asKeyword, alias]) => joinWithRandomInlineSpaces(asKeyword, alias));

// Simple table (name + columns only)
export const simpleTableArbitrary = fc.tuple(
  caseVariant('Table'),
  anyElementNameArbitrary, // Can be schema.table or just table
  columnListArbitrary,
).chain(([keyword, name, cols]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${cols}\n}`,
  ),
);

// Table with alias (Table users as u { ... })
export const tableWithAliasArbitrary = fc.tuple(
  caseVariant('Table'),
  anyElementNameArbitrary,
  tableAliasArbitrary,
  columnListArbitrary,
).chain(([keyword, name, alias, cols]) =>
  joinWithRandomSpaces(keyword, name, alias, '{').map((header) =>
    `${header}\n${cols}\n}`,
  ),
);

// Table with settings
export const tableWithSettingsArbitrary = fc.tuple(
  caseVariant('Table'),
  anyElementNameArbitrary,
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
  anyElementNameArbitrary,
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
  anyElementNameArbitrary,
  columnListArbitrary,
  fc.oneof(inlineNoteArbitrary, blockNoteArbitrary),
).chain(([keyword, name, cols, note]) =>
  joinWithRandomSpaces(keyword, name, '{').map((header) =>
    `${header}\n${cols}\n\n${note}\n}`,
  ),
);

// Table with everything (including optional alias)
export const complexTableArbitrary = fc.tuple(
  caseVariant('Table'),
  anyElementNameArbitrary,
  fc.option(tableAliasArbitrary, { nil: undefined }),
  fc.option(tableSettingsListArbitrary, { nil: undefined }),
  columnListArbitrary,
  fc.option(indexesBlockArbitrary, { nil: undefined }),
  fc.option(checksBlockArbitrary, { nil: undefined }),
  fc.option(fc.oneof(inlineNoteArbitrary, blockNoteArbitrary), { nil: undefined }),
).chain(([keyword, name, alias, settings, cols, indexes, checks, note]) => {
  const headerParts = [keyword, name];
  if (alias) headerParts.push(alias);
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
  { weight: 3, arbitrary: simpleTableArbitrary },
  { weight: 1, arbitrary: tableWithAliasArbitrary },
  { weight: 2, arbitrary: tableWithSettingsArbitrary },
  { weight: 2, arbitrary: tableWithIndexesArbitrary },
  { weight: 2, arbitrary: tableWithNoteArbitrary },
  { weight: 2, arbitrary: complexTableArbitrary },
);

// TableGroup settings (uses color, not headercolor)
export const tableGroupSettingArbitrary = fc.oneof(
  settingKeyValue('color', colorArbitrary),
  noteSettingArbitrary,
);

export const tableGroupSettingsListArbitrary = fc.array(tableGroupSettingArbitrary, { minLength: 1, maxLength: 2 })
  .map((settings) => `[${settings.join(', ')}]`);

// TableGroup - increased table reference bounds
export const tableGroupArbitrary = fc.tuple(
  caseVariant('TableGroup'),
  fc.option(anyIdentifierArbitrary, { nil: undefined }), // TableGroup name must be simple identifier
  fc.array(maybeWithComment(anyElementNameArbitrary), { minLength: 1, maxLength: 20 }), // Table refs can be schema-qualified
  fc.option(tableGroupSettingsListArbitrary, { nil: undefined }),
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

// Standalone/sticky note - name can be schema-qualified (e.g., Note auth.users { ... })
export const standaloneNoteArbitrary = fc.tuple(
  caseVariant('Note'),
  anyElementNameArbitrary, // Can be schema.table for sticky notes
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

// Small schema (1-5 tables, 0-3 enums) - increased bounds
export const smallSchemaArbitrary = fc.tuple(
  fc.option(projectArbitrary, { nil: undefined }),
  fc.array(enumArbitrary, { minLength: 0, maxLength: 3 }),
  fc.array(tableArbitrary, { minLength: 1, maxLength: 5 }),
  fc.array(anyRefArbitrary, { minLength: 0, maxLength: 5 }),
  fc.option(singleLineCommentArbitrary, { nil: undefined }), // Optional leading comment
).map(([project, enums, tables, refs, comment]) => {
  const parts = [];
  if (comment) parts.push(comment);
  if (project) parts.push(project);
  parts.push(...enums);
  parts.push(...tables);
  parts.push(...refs);
  return parts.join('\n\n');
});

// Medium schema (3-10 tables, 2-6 enums) - increased bounds
export const mediumSchemaArbitrary = fc.tuple(
  fc.option(projectArbitrary, { nil: undefined }),
  fc.array(enumArbitrary, { minLength: 1, maxLength: 6 }),
  fc.array(tableArbitrary, { minLength: 3, maxLength: 10 }),
  fc.array(anyRefArbitrary, { minLength: 2, maxLength: 10 }),
  fc.array(tableGroupArbitrary, { minLength: 0, maxLength: 4 }),
  fc.array(tablePartialArbitrary, { minLength: 0, maxLength: 2 }), // Add TablePartials
).map(([project, enums, tables, refs, groups, partials]) => {
  const parts = [];
  if (project) parts.push(project);
  parts.push(...partials);
  parts.push(...enums);
  parts.push(...tables);
  parts.push(...groups);
  parts.push(...refs);
  return parts.join('\n\n');
});

// Large schema (8-20 tables, complex relationships) - increased bounds significantly
export const largeSchemaArbitrary = fc.tuple(
  fc.option(projectArbitrary, { nil: undefined }),
  fc.array(enumArbitrary, { minLength: 3, maxLength: 10 }),
  fc.array(complexTableArbitrary, { minLength: 8, maxLength: 20 }),
  fc.array(anyRefArbitrary, { minLength: 5, maxLength: 25 }),
  fc.array(tableGroupArbitrary, { minLength: 1, maxLength: 5 }),
  fc.array(standaloneNoteArbitrary, { minLength: 0, maxLength: 5 }),
  fc.array(tablePartialArbitrary, { minLength: 0, maxLength: 3 }),
).map(([project, enums, tables, refs, groups, notes, partials]) => {
  const parts = [];
  if (project) parts.push(project);
  parts.push(...partials);
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

// Mismatched brackets - generates dynamic open/close bracket mismatches
export const mismatchedBracketsArbitrary = fc.tuple(
  fc.constantFrom('[', '{', '('),
  fc.nat({ max: 10 }),
).map(([open, n]) => {
  const mismatchedClose: Record<string, string> = { '[': '}', '{': ']', '(': ']' };
  const count = n + 1;
  return open.repeat(count) + mismatchedClose[open].repeat(count);
});

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
  // Ensure we cut at least 1 char but not the whole string, and have at least 1 char remaining
  const maxCut = Math.max(1, source.length - 1);
  const point = (cutPoint % maxCut) + 1;
  return source.slice(0, point);
});

// Invalid escape sequences - generates arbitrary invalid escape characters
export const invalidEscapeArbitrary = fc.oneof(
  // Invalid escape character (exclude valid escapes: n, r, t, ', ", \, 0-7 for octal)
  fc.stringMatching(/^[a-mo-su-zA-MO-SU-Z89]$/).map((char) => `'\\${char}'`),
  // Incomplete unicode escape
  fc.stringMatching(/^[0-9A-Fa-f]{0,3}$/).map((hex) => `'\\u${hex}'`),
  // Trailing backslash
  fc.string({ minLength: 0, maxLength: 10 }).map((s) => `'${s.replace(/['\\]/g, '')}\\'`),
);

// Binary garbage (non-printable characters)
export const binaryGarbageArbitrary = fc.uint8Array({ minLength: 1, maxLength: 100 })
  .map((arr) => String.fromCharCode(...arr));

// Extremely deep nesting (>1000 levels)
export const extremeNestingArbitrary = fc.integer({ min: 500, max: 2000 })
  .map((depth) => '['.repeat(depth) + ']'.repeat(depth));

// Malformed table declarations - generates various incomplete/invalid table syntax
export const malformedTableArbitrary = fc.oneof(
  // Missing name and body
  caseVariant('Table'),
  // Missing body (unclosed brace)
  fc.tuple(caseVariant('Table'), anyIdentifierArbitrary)
    .map(([kw, name]) => `${kw} ${name} {`),
  // Unclosed settings bracket
  fc.tuple(caseVariant('Table'), anyIdentifierArbitrary, anyIdentifierArbitrary, columnTypeArbitrary)
    .map(([kw, name, col, type]) => `${kw} ${name} { ${col} ${type} [`),
  // Trailing garbage after valid table
  fc.tuple(caseVariant('Table'), anyIdentifierArbitrary, anyIdentifierArbitrary, columnTypeArbitrary, identifierArbitrary)
    .map(([kw, name, col, type, garbage]) => `${kw} ${name} { ${col} ${type} } ${garbage}`),
  // Table keyword with brace but no name
  caseVariant('Table').map((kw) => `${kw} {`),
);

// Malformed enum declarations - generates various incomplete/invalid enum syntax
export const malformedEnumArbitrary = fc.oneof(
  // Missing name and body
  caseVariant('Enum'),
  // Missing name (brace without name)
  caseVariant('Enum').map((kw) => `${kw} {`),
  // Missing body (name without brace)
  fc.tuple(caseVariant('Enum'), anyIdentifierArbitrary)
    .map(([kw, name]) => `${kw} ${name}`),
  // Unclosed brace
  fc.tuple(caseVariant('Enum'), anyIdentifierArbitrary, anyIdentifierArbitrary)
    .map(([kw, name, value]) => `${kw} ${name} { ${value}`),
  // Malformed value with unclosed settings
  fc.tuple(caseVariant('Enum'), anyIdentifierArbitrary, anyIdentifierArbitrary)
    .map(([kw, name, value]) => `${kw} ${name} { ${value} [note: 'x' }`),
);

// Malformed ref declarations - generates various incomplete/invalid ref syntax
export const malformedRefArbitrary = fc.oneof(
  // Missing endpoints (just colon)
  caseVariant('Ref').map((kw) => `${kw}:`),
  // Incomplete - missing second endpoint after operator
  fc.tuple(caseVariant('Ref'), schemaQualifiedNameArbitrary, anyIdentifierArbitrary, relationshipTypeArbitrary)
    .map(([kw, table, col, rel]) => `${kw}: ${table}.${col} ${rel}`),
  // Missing first endpoint (operator with only second endpoint)
  fc.tuple(caseVariant('Ref'), relationshipTypeArbitrary, schemaQualifiedNameArbitrary, anyIdentifierArbitrary)
    .map(([kw, rel, table, col]) => `${kw}: ${rel} ${table}.${col}`),
  // Unclosed settings bracket
  fc.tuple(
    caseVariant('Ref'),
    schemaQualifiedNameArbitrary, anyIdentifierArbitrary,
    relationshipTypeArbitrary,
    schemaQualifiedNameArbitrary, anyIdentifierArbitrary,
  ).map(([kw, t1, c1, rel, t2, c2]) => `${kw}: ${t1}.${c1} ${rel} ${t2}.${c2} [`),
  // Trailing garbage after valid ref
  fc.tuple(
    caseVariant('Ref'),
    schemaQualifiedNameArbitrary, anyIdentifierArbitrary,
    relationshipTypeArbitrary,
    schemaQualifiedNameArbitrary, anyIdentifierArbitrary,
    identifierArbitrary,
  ).map(([kw, t1, c1, rel, t2, c2, garbage]) => `${kw}: ${t1}.${c1} ${rel} ${t2}.${c2} ${garbage}`),
);

// Columns with conflicting settings - generates dynamic conflicting setting combinations
const conflictingPairs = [
  ['pk', 'null'],
  ['not null', 'null'],
] as const;
const duplicatableSettings = ['pk', 'unique', 'increment', 'not null'] as const;

export const conflictingSettingsArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  anyIdentifierArbitrary,
  columnTypeArbitrary,
  fc.oneof(
    // Conflicting pair (e.g., pk + null, not null + null)
    fc.constantFrom(...conflictingPairs).chain(([a, b]) =>
      fc.tuple(caseVariant(a), caseVariant(b)).map(([va, vb]) => `[${va}, ${vb}]`),
    ),
    // Duplicate settings (e.g., pk, pk or unique, unique)
    fc.constantFrom(...duplicatableSettings).chain((setting) =>
      fc.tuple(caseVariant(setting), caseVariant(setting)).map(([v1, v2]) => `[${v1}, ${v2}]`),
    ),
    // Triple duplicate
    fc.constantFrom(...duplicatableSettings).chain((setting) =>
      fc.tuple(caseVariant(setting), caseVariant(setting), caseVariant(setting))
        .map(([v1, v2, v3]) => `[${v1}, ${v2}, ${v3}]`),
    ),
  ),
).map(([kw, table, col, type, settings]) => `${kw} ${table} { ${col} ${type} ${settings} }`);

// Zero-column tables - generates tables with arbitrary names and varied whitespace
export const emptyTableArbitrary = fc.tuple(
  caseVariant('Table'),
  anyIdentifierArbitrary,
  fc.oneof(
    fc.constant('{}'),
    fc.constant('{ }'),
    fc.stringMatching(/^\{[ \t]*\n[ \t]*\}$/).filter((s) => s.length < 20),
    fc.stringMatching(/^\{[ \t\n]*\}$/).filter((s) => s.length < 15),
  ),
).map(([kw, name, body]) => `${kw} ${name} ${body}`);

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

// Composite foreign keys with mismatched column counts - generates arbitrary mismatched refs
export const mismatchedCompositeRefArbitrary = fc.tuple(
  caseVariant('Ref'),
  schemaQualifiedNameArbitrary,
  schemaQualifiedNameArbitrary,
  fc.integer({ min: 1, max: 5 }),
  fc.integer({ min: 1, max: 5 }),
  relationshipTypeArbitrary,
).chain(([kw, t1, t2, count1, count2, rel]) => {
  // Ensure counts are different for mismatch
  const actualCount2 = count1 === count2 ? count2 + 1 : count2;
  return fc.tuple(
    fc.array(anyIdentifierArbitrary, { minLength: count1, maxLength: count1 }),
    fc.array(anyIdentifierArbitrary, { minLength: actualCount2, maxLength: actualCount2 }),
  ).map(([cols1, cols2]) =>
    `${kw}: ${t1}.(${cols1.join(', ')}) ${rel} ${t2}.(${cols2.join(', ')})`,
  );
});

// Combined malformed arbitrary (for comprehensive fuzzing)
// Only includes syntactically invalid inputs - semantic issues (conflicting settings,
// dangling refs, mismatched composite refs, empty tables) are tested separately
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
