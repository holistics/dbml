import { isEqual, uniqWith } from 'lodash-es';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  NormalExpressionNode,
} from '@/core/parser/nodes';
import { ColumnSymbol, TableSymbol } from '@/core/analyzer/symbol/symbols';
import { destructureCallExpression, extractReferee, getElementKind } from '@/core/analyzer/utils';
import { InterpreterDatabase, Table, RelationCardinality } from '@/core/interpreter/types';
import { RefRelation } from '@/constants';
import { RecordsBatch } from '../../types';
import { processColumnSchemas } from './column';
import { ElementKind } from '@/core/analyzer/types';
import { isTupleOfVariables } from '@/core/analyzer/validator/utils';

// Get TableSymbol from a callee expression (handles both simple and schema.table)
export function getTableSymbol (callee?: NormalExpressionNode): TableSymbol | null {
  const referee = extractReferee(callee);
  return referee instanceof TableSymbol ? referee : null;
}

// Get Table object from a TableSymbol using env
export function getTable (tableSymbol: TableSymbol, env: InterpreterDatabase): Table | null {
  const declaration = tableSymbol.declaration;
  if (declaration instanceof ElementDeclarationNode) {
    return env.tables.get(declaration) || null;
  }
  return null;
}

function getRefRelation (card1: RelationCardinality, card2: RelationCardinality): RefRelation {
  if (card1 === '*' && card2 === '1') return RefRelation.ManyToOne;
  if (card1 === '1' && card2 === '*') return RefRelation.OneToMany;
  if (card1 === '1' && card2 === '1') return RefRelation.OneToOne;
  return RefRelation.ManyToMany;
}

export function processTableSchema (
  table: Table,
  tableSymbol: TableSymbol,
  columnSymbols: ColumnSymbol[],
  env: InterpreterDatabase,
): RecordsBatch {
  const result: RecordsBatch = {
    table: table.name,
    schema: table.schemaName,
    columns: processColumnSchemas(table, columnSymbols),
    constraints: {
      pk: [],
      unique: [],
      fk: [],
    },
    rows: [],
  };

  const pks: string[][] = [];
  const uniques: string[][] = [];

  // Collect inline constraints from fields
  const inlinePkColumns: string[] = [];
  table.fields.forEach((field) => {
    if (field.pk) {
      inlinePkColumns.push(field.name);
    }
    if (field.unique) {
      uniques.push([field.name]);
    }
  });

  if (inlinePkColumns.length > 0) {
    pks.push(inlinePkColumns);
  }

  // Collect index constraints
  table.indexes.forEach((index) => {
    if (index.pk) {
      pks.push(index.columns.map((col) => col.value));
    }
    if (index.unique) {
      uniques.push(index.columns.map((col) => col.value));
    }
  });

  result.constraints.pk = uniqWith(pks, isEqual);
  result.constraints.unique = uniqWith(uniques, isEqual);

  // Collect FKs from env.ref
  for (const ref of env.ref.values()) {
    const [e1, e2] = ref.endpoints;
    if (e1.tableName === table.name && e1.schemaName === table.schemaName) {
      result.constraints.fk.push({
        sourceColumns: e1.fieldNames,
        targetSchema: e2.schemaName,
        targetTable: e2.tableName,
        targetColumns: e2.fieldNames,
        relation: getRefRelation(e1.relation, e2.relation),
      });
    } else if (e2.tableName === table.name && e2.schemaName === table.schemaName) {
      result.constraints.fk.push({
        sourceColumns: e2.fieldNames,
        targetSchema: e1.schemaName,
        targetTable: e1.tableName,
        targetColumns: e1.fieldNames,
        relation: getRefRelation(e2.relation, e1.relation),
      });
    }
  }

  return result;
}

// Collect column symbols from table body in declaration order
function collectColumnSymbols (tableElement: ElementDeclarationNode): ColumnSymbol[] {
  const columnSymbols: ColumnSymbol[] = [];
  if (tableElement.body instanceof BlockExpressionNode) {
    for (const node of tableElement.body.body) {
      if (node instanceof FunctionApplicationNode && node.symbol instanceof ColumnSymbol) {
        columnSymbols.push(node.symbol);
      }
    }
  }
  return columnSymbols;
}

// Resolve inline records: table users { records (id, name) { ... } }
function resolveInlineRecords (
  element: ElementDeclarationNode,
  env: InterpreterDatabase,
): { table: Table; tableSymbol: TableSymbol; columnSymbols: ColumnSymbol[] } | null {
  const parent = element.parent;
  if (!(parent instanceof ElementDeclarationNode)) return null;
  if (getElementKind(parent).unwrap_or(undefined) !== ElementKind.Table) return null;

  const tableSymbol = parent.symbol as TableSymbol;
  const table = getTable(tableSymbol, env);
  if (!table) return null;

  const columnSymbols = isTupleOfVariables(element.name)
    ? element.name.elementList.map((a) => a.referee as ColumnSymbol).filter((s) => !!s)
    : collectColumnSymbols(parent);

  return { table, tableSymbol, columnSymbols };
}

// Resolve top-level records: records users(id, name) { ... }
function resolveTopLevelRecords (
  element: ElementDeclarationNode,
  env: InterpreterDatabase,
): { table: Table; tableSymbol: TableSymbol; columnSymbols: ColumnSymbol[] } | null {
  const nameNode = element.name;
  let tableSymbol: TableSymbol | null = null;
  let columnSymbols: ColumnSymbol[] = [];

  if (nameNode instanceof CallExpressionNode) {
    tableSymbol = getTableSymbol(nameNode.callee);
    const fragments = destructureCallExpression(nameNode).unwrap_or(undefined);
    if (fragments) {
      columnSymbols = fragments.args.map((a) => a.referee as ColumnSymbol).filter((s) => !!s);
    }
  } else {
    tableSymbol = getTableSymbol(nameNode);
  }

  if (!tableSymbol) return null;

  const table = getTable(tableSymbol, env);
  if (!table) return null;

  const tableDecl = tableSymbol.declaration;
  if (columnSymbols.length === 0 && tableDecl instanceof ElementDeclarationNode) {
    columnSymbols = collectColumnSymbols(tableDecl);
  }

  return { table, tableSymbol, columnSymbols };
}

// Resolve table and columns from a records element
export function resolveTableAndColumnsOfRecords (
  element: ElementDeclarationNode,
  env: InterpreterDatabase,
): { table: Table; tableSymbol: TableSymbol; columnSymbols: ColumnSymbol[] } | null {
  return resolveInlineRecords(element, env) || resolveTopLevelRecords(element, env);
}
