import { ElementDeclarationNode, FunctionApplicationNode } from '@/core/parser/nodes';
import type Compiler from '@/compiler/index';
import { SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';
import type { Table, Column } from '@/core/types/schemaJson';
import { extractElementName, getTokenPosition } from '../../utils';
import { isValidPartialInjection } from '@/core/utils/validate';

// Build a Table object from an element node using interpret (includes indexes, checks, etc.)
// and symbolMembers (includes partial-injected columns).
export function buildTableFromElement (tableNode: ElementDeclarationNode, compiler: Compiler): Table | undefined {
  const interpreted = compiler.interpret(tableNode).getFiltered(UNHANDLED);
  // interpret may return [Table, ...TableRecord] when there are nested records
  const baseTable = Array.isArray(interpreted) ? interpreted[0] as Table : interpreted as Table | undefined;
  if (!baseTable) return undefined;

  // The interpreted table only has direct fields. Merge partial-injected columns from symbolMembers.
  // symbolMembers respects injection position order.
  const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
  if (!tableSymbol) return baseTable;
  const members = compiler.symbolMembers(tableSymbol).getFiltered(UNHANDLED);
  if (!members) return baseTable;

  // Check if there are any partial columns to merge
  const hasPartialColumns = members.some((m) =>
    m.declaration && m.isKind(SymbolKind.Column) && m.declaration.parent !== tableNode,
  );
  if (!hasPartialColumns) return baseTable;

  // Build merged field list in symbolMembers order (injection-position-aware)
  const directFieldMap = new Map(baseTable.fields.map((f) => [f.name, f]));
  const seen = new Set<string>();
  const mergedFields: Column[] = [];
  for (const member of members) {
    if (!member.declaration || !member.isKind(SymbolKind.Column)) continue;
    if (member.declaration instanceof FunctionApplicationNode && isValidPartialInjection(member.declaration.callee)) continue;

    const memberName = compiler.symbolName(member);
    if (!memberName) continue;

    const isDirect = member.declaration.parent === tableNode;
    const directField = isDirect ? directFieldMap.get(memberName) : undefined;

    if (directField) {
      // Direct fields always win - skip if already seen (shouldn't happen for direct)
      if (!seen.has(memberName)) {
        seen.add(memberName);
        mergedFields.push(directField);
      }
    } else {
      // Partial-injected column - later partials override earlier ones
      const column = compiler.interpret(member.declaration).getFiltered(UNHANDLED) as Column | undefined;
      if (column) {
        if (seen.has(column.name)) {
          // Override: replace existing partial column (but not direct fields)
          const existingIdx = mergedFields.findIndex((f) => f.name === column.name);
          if (existingIdx >= 0 && !directFieldMap.has(column.name)) {
            mergedFields[existingIdx] = column;
          }
        } else {
          seen.add(column.name);
          mergedFields.push(column);
        }
      }
    }
  }

  return {
    ...baseTable,
    fields: mergedFields,
  };
}

// Build a Table object from a table node's symbol members (including partial-injected columns),
// without calling compiler.interpret(tableNode) (avoids cycle when called from nested records).
export function buildTableFromSymbolMembers (tableNode: ElementDeclarationNode, compiler: Compiler): Table | undefined {
  const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
  if (!tableSymbol) return undefined;
  const members = compiler.symbolMembers(tableSymbol).getFiltered(UNHANDLED);
  if (!members) return undefined;

  const { name, schemaName } = extractElementName(tableNode.name!);

  const fields: Column[] = [];
  for (const member of members) {
    if (!member.declaration || !member.isKind(SymbolKind.Column)) continue;
    // Skip partial injection nodes (~PartialName) - these are not real columns
    if (member.declaration instanceof FunctionApplicationNode && isValidPartialInjection(member.declaration.callee)) continue;
    // Interpret each column individually (works for both direct and partial columns)
    const column = compiler.interpret(member.declaration).getFiltered(UNHANDLED) as Column | undefined;
    if (column) {
      fields.push(column);
    }
  }

  return {
    name,
    schemaName: schemaName.length > 0 ? schemaName[0] : null,
    alias: null,
    fields,
    token: getTokenPosition(tableNode),
    indexes: [],
    partials: [],
    checks: [],
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
    if (!isNaN(precision) && !isNaN(scale)) return { precision, scale };
  }
  if (parts.length === 1) {
    const precision = parseInt(parts[0], 10);
    if (!isNaN(precision)) return { precision, scale: 0 };
  }
  return undefined;
}

export function parseLengthParam (column: Column): { length: number } | undefined {
  const args = column.type.args;
  if (!args) return undefined;
  const length = parseInt(args.trim(), 10);
  if (!isNaN(length)) return { length };
  return undefined;
}
