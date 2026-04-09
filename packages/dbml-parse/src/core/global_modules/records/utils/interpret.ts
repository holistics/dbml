import { ElementDeclarationNode, FunctionApplicationNode } from '@/core/parser/nodes';
import type Compiler from '@/compiler/index';
import { SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';
import type { Table, Column, TablePartial, Ref } from '@/core/types/schemaJson';
import { isValidPartialInjection } from '@/core/utils/validate';
import { extractVariableFromExpression, getBody, isElementNode } from '@/core/utils/expression';
import { ElementKind } from '@/core/types';
import { uniqBy } from 'lodash-es';
import { getMultiplicities } from '../../utils';

// Build a Table object from an element node using interpret (includes indexes, checks, etc.)
// and symbolMembers (includes partial-injected columns).
// The returned table respects (injected) column definition order
export function buildMergedTableFromElement (tableNode: ElementDeclarationNode, compiler: Compiler): Table | undefined {
  const baseTable = compiler.interpret(tableNode).getFiltered(UNHANDLED) as Table | undefined;
  if (!baseTable) return undefined;

  const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
  if (!tableSymbol) return undefined;

  const tableMembers = compiler.symbolMembers(tableSymbol).getFiltered(UNHANDLED);
  if (!tableMembers) return undefined;

  const indexes = [...baseTable.indexes];
  const checks = [...baseTable.checks];
  let headerColor = baseTable.headerColor;
  let note = baseTable.note;

  const partialMap = new Map<string, TablePartial>();

  // Prioritize later table partials
  for (const partialInjection of tableMembers.filter((m) => m.isKind(SymbolKind.PartialInjection)).reverse()) {
    if (!(partialInjection.declaration instanceof FunctionApplicationNode) || !isValidPartialInjection(partialInjection.declaration.callee) || !partialInjection.declaration.callee.expression) continue;
    const tablePartialNode = compiler.nodeReferee(partialInjection.declaration.callee.expression).getFiltered(UNHANDLED)?.declaration;
    if (!isElementNode(tablePartialNode, ElementKind.TablePartial)) continue;

    const tablePartial = compiler.interpret(tablePartialNode).getFiltered(UNHANDLED) as TablePartial | undefined;
    if (!tablePartial) continue;

    partialMap.set(tablePartial.name, tablePartial);

    // Merge indexes
    indexes.push(...tablePartial.indexes);

    // Merge checks
    checks.push(...tablePartial.checks);

    // Merge settings (later partials override)
    if (tablePartial.headerColor !== undefined) {
      headerColor = tablePartial.headerColor;
    }
    if (tablePartial.note !== undefined) {
      note = tablePartial.note;
    }
  }

  const directFieldMap = new Map(baseTable.fields.map((f) => [f.name, f]));
  const directFieldNames = new Set(directFieldMap.keys());

  // Collect all fields in declaration order
  const allFields: Column[] = [];

  for (const subfield of getBody(tableNode)) {
    if (!(subfield instanceof FunctionApplicationNode)) continue;

    if (isValidPartialInjection(subfield.callee)) {
      // Inject partial fields
      const partialName = extractVariableFromExpression(subfield.callee.expression);
      const partial = partialMap.get(partialName!);
      if (!partial) continue;

      for (const field of partial.fields) {
        // Skip if overridden by direct definition
        if (directFieldNames.has(field.name)) continue;
        allFields.push(field);
      }
    } else {
      // Add direct field definition
      const columnName = extractVariableFromExpression(subfield.callee);
      const column = directFieldMap.get(columnName!);
      if (!column) continue;
      allFields.push(column);
    }
  }

  // Use uniqBy to keep last occurrence of each field (later partials win)
  // Process from end to start, then reverse to maintain declaration order
  const fields = uniqBy([...allFields].reverse(), 'name').reverse();

  return {
    ...baseTable,
    fields,
    indexes,
    checks,
    headerColor,
    note,
  };
}

// Look up enum field names for a column's enum type via the compiler's symbol graph.
export function getEnumMembers (column: Column, compiler: Compiler): string[] {
  const ast = compiler.parseFile().getValue().ast;
  const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!programSymbol) return [];
  const schemas = compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED);
  if (!schemas) return [];

  // Flatten through schemas to find enums
  const allMembers = schemas.flatMap((s) => {
    if (!(s instanceof SchemaSymbol)) return [s];
    const schemaMembers = compiler.symbolMembers(s).getFiltered(UNHANDLED);
    return schemaMembers ? [s, ...schemaMembers] : [s];
  });

  for (const member of allMembers) {
    if (!member.isKind(SymbolKind.Enum) || !member.declaration) continue;

    const fullname = compiler.fullname(member.declaration).getFiltered(UNHANDLED);
    if (!fullname || fullname.at(-1) !== column.type.type_name) continue;

    const enumSchemaName = fullname.length > 1 ? fullname.slice(0, -1).join('.') : null;
    if (enumSchemaName !== column.type.schemaName) continue;

    const enumSymbol = compiler.nodeSymbol(member.declaration).getFiltered(UNHANDLED);
    if (!enumSymbol) continue;
    const enumFields = compiler.symbolMembers(enumSymbol).getFiltered(UNHANDLED);
    if (!enumFields) continue;

    return enumFields
      .filter((field) => field.declaration)
      .map((field) => compiler.fullname(field.declaration!).getFiltered(UNHANDLED)?.at(-1))
      .filter(Boolean) as string[];
  }

  return [];
}

export function parseNumericParams (column: Column): { precision: number; scale: number } | undefined {
  const args = column.type.args;
  if (!args) return undefined;
  const parts = args.split(',').map((s) => s.trim());
  if (parts.length === 2) {
    const precision = parseInt(parts[0], 10);
    const scale = parseInt(parts[1], 10);
    if (!Number.isNaN(precision) && !Number.isNaN(scale)) return { precision, scale };
  }
  if (parts.length === 1) {
    const precision = parseInt(parts[0], 10);
    if (!Number.isNaN(precision)) return { precision, scale: 0 };
  }
  return undefined;
}

export function parseLengthParam (column: Column): { length: number } | undefined {
  const args = column.type.args;
  if (!args) return undefined;
  const length = parseInt(args.trim(), 10);
  if (!Number.isNaN(length)) return { length };
  return undefined;
}

export function extractInlineRefsFromTablePartials (table: Table, tablePartials: TablePartial[]): Ref[] {
  const refs: Ref[] = [];
  const originalFieldNames = new Set(table.fields.map((f) => f.name));

  // Process partials in the same order as mergeTableAndPartials
  for (const tablePartial of [...table.partials].reverse()) {
    const { name } = tablePartial;
    const partial = tablePartials.find((p) => p.name === name);
    if (!partial) continue;

    // Extract inline refs from partial fields
    for (const field of partial.fields) {
      // Skip if this field is overridden by the original table
      if (originalFieldNames.has(field.name)) continue;

      for (const inlineRef of field.inline_refs) {
        const multiplicities = getMultiplicities(inlineRef.relation);
        if (!multiplicities) continue;
        refs.push({
          name: null,
          schemaName: null,
          token: inlineRef.token,
          endpoints: [
            {
              schemaName: inlineRef.schemaName,
              tableName: inlineRef.tableName,
              fieldNames: inlineRef.fieldNames,
              token: inlineRef.token,
              relation: multiplicities[1],
            },
            {
              schemaName: table.schemaName,
              tableName: table.name,
              fieldNames: [field.name],
              token: field.token,
              relation: multiplicities[0],
            },
          ],
        });
      }
    }
  }

  return refs;
}
