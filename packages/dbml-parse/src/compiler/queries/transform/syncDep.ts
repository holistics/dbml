/**
 * Dep block transform - read and write `Dep` blocks in DBML source.
 *
 * Parallel to {@link ./syncDiagramView.ts}, but a Dep block has no name to
 * key on - a block is identified by its edge endpoints (upstream/downstream
 * schema + table + fields). The color picker uses this to write a dep's
 * `[color]`:
 *   - `update` an existing block's `[color]`, or
 *   - `create` a direct `Dep { a -> b } [color: <hex>]` when the picked
 *     (table-level) line has no backing block, or
 *   - `remove` an existing block's `[color]` so the dep falls back to its
 *     upstream -> group -> grey default.
 * `create` treats an already-matching block as an `update`, so it never
 * produces a duplicate `Dep`. `remove` on an edge with no block is a no-op.
 */

import { DEFAULT_ENTRY } from '@/constants';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { Filepath } from '@/core/types/filepath';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { DEP_DOWNSTREAM, DEP_UPSTREAM } from '@/core/types/schemaJson';
import {
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import { destructureComplexVariable, extractSettingName } from '@/core/utils/expression';
import type Compiler from '../../index';
import { endpointMatches, formatEndpoint } from './utils';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import { updateNoteEdit, removeNoteEdit, addNoteEdit } from '@/core/utils/note';
import { updateSettingEdit, removeSettingEdit } from '@/core/utils/setting';

// Types

export interface DepEndpointRef {
  schemaName?: string | null;
  tableName: string;
  fieldNames?: string[];
}

export interface DepSyncEdge {
  upstream: DepEndpointRef;
  downstream: DepEndpointRef;
}

export interface DepSyncOperation {
  operation: 'create' | 'update' | 'remove';
  /** The edge that identifies the target block (table-level: empty fields). */
  edge: DepSyncEdge;
  /** Set to a value to create/update, null to remove, undefined to leave unchanged. */
  color?: string | null;
  /** Set to a value to create/update, null to remove, undefined to leave unchanged. */
  note?: string | null;
}

export interface DepBlock {
  startIndex: number;
  endIndex: number;
  declaration: ElementDeclarationNode;
  edges: DepSyncEdge[];
}

export interface InlineDep {
  edge: DepSyncEdge;
  fullStart: number;
  fullEnd: number;
}

/**
 * Synchronizes `Dep` blocks in the DBML source at `filepath`.
 * Applies create/update/remove operations and returns the rewritten source.
 */
export function syncDep (
  this: Compiler,
  filepath: Filepath,
  operations: DepSyncOperation[],
  blocks?: DepBlock[],
): {
  newDbml: string;
  edits: TextEdit[];
} {
  const dbml = this.getSource(filepath) ?? '';
  const program = this.parseFile(filepath).getValue().ast;
  const originalBlocks = blocks ?? depBlocksFromProgram(program);
  const inlineDeps = inlineDepsFromProgram(dbml, program);
  const allEdits: TextEdit[] = [];

  for (const op of operations) {
    allEdits.push(...applyOperation(dbml, op, originalBlocks, inlineDeps));
  }

  allEdits.sort((a, b) => b.start - a.start);
  const newDbml = applyTextEdits(dbml, allEdits, true);
  return { newDbml, edits: allEdits };
}

/**
 * Returns every standalone `Dep` block in `source`.
 * On lex/parse error returns [] (mirrors findDiagramViewBlocks).
 */
export function findDepBlocks (source: string): DepBlock[] {
  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return [];

  const ast = new Parser(source, lexerResult.getValue(), new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return [];

  return depBlocksFromProgram(ast.getValue().ast);
}

/** Returns every inline `[dep: -> target]` setting on columns in `source`. */
export function findInlineDeps (source: string): InlineDep[] {
  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return [];

  const ast = new Parser(source, lexerResult.getValue(), new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return [];

  return inlineDepsFromProgram(source, ast.getValue().ast);
}

/** Emit a `Dep` block string for one edge with a `[color]` setting. */
export function generateDepBlock (edge: DepSyncEdge, color: string): string {
  const up = formatEndpoint(edge.upstream);
  const down = formatEndpoint(edge.downstream);
  return `Dep [color: ${color}] {\n  ${up} -> ${down}\n}`;
}

/** Extract `DepBlock[]` from an already-parsed program AST. */
export function depBlocksFromProgram (program: ProgramNode): DepBlock[] {
  const blocks: DepBlock[] = [];

  for (const element of program.declarations) {
    if (!(element instanceof ElementDeclarationNode) || !element.isKind(ElementKind.Dep)) continue;

    const edges: DepSyncEdge[] = [];

    const body = element.body;
    if (body instanceof FunctionApplicationNode) {
      if (body.callee instanceof InfixExpressionNode) {
        const edge = edgeFromInfix(body.callee);
        if (edge) edges.push(edge);
      }
    } else if (body) {
      for (const field of body.body) {
        if (field instanceof FunctionApplicationNode && field.callee instanceof InfixExpressionNode) {
          const edge = edgeFromInfix(field.callee);
          if (edge) edges.push(edge);
        }
      }
    }

    blocks.push({
      startIndex: element.start,
      endIndex: element.end,
      declaration: element,
      edges,
    });
  }

  return blocks;
}

/** Extract `InlineDep[]` from an already-parsed program AST. */
export function inlineDepsFromProgram (source: string, program: ProgramNode): InlineDep[] {
  const result: InlineDep[] = [];

  for (const element of program.declarations) {
    if (!(element instanceof ElementDeclarationNode) || !element.isKind(ElementKind.Table)) continue;
    const tableFragments = element.name ? destructureComplexVariable(element.name) ?? [] : [];
    if (tableFragments.length === 0) continue;

    const tableName = tableFragments[tableFragments.length - 1];
    const schemaName = tableFragments.length > 1 ? tableFragments[tableFragments.length - 2] : undefined;

    const body = element.body;
    if (!body || body instanceof FunctionApplicationNode) continue;
    for (const field of body.body) {
      if (!(field instanceof FunctionApplicationNode) || !field.callee) continue;
      const columnName = destructureComplexVariable(field.callee)?.at(-1);
      if (!columnName) continue;

      const host: DepEndpointRef = {
        schemaName,
        tableName,
        fieldNames: [
          columnName,
        ],
      };
      const edit = removeSettingEdit(field, SettingName.Dep, source);
      if (!edit) continue;
      for (const dep of extractInlineDepEdges(field, host)) {
        result.push({ edge: dep, fullStart: edit.start, fullEnd: edit.end });
      }
    }
  }

  return result;
}

// Private helpers

/** Parse an `a -> b` / `a <- b` infix node into a DepSyncEdge. */
function edgeFromInfix (infix: InfixExpressionNode): DepSyncEdge | undefined {
  const op = infix.op?.value;
  if (op !== DEP_DOWNSTREAM && op !== DEP_UPSTREAM) return undefined;
  const left = infix.leftExpression;
  const right = infix.rightExpression;
  if (!left || !right) return undefined;

  const upstreamNode = op === DEP_UPSTREAM ? right : left;
  const downstreamNode = op === DEP_UPSTREAM ? left : right;

  const upFragments = destructureComplexVariable(upstreamNode);
  const downFragments = destructureComplexVariable(downstreamNode);
  if (!upFragments || !downFragments) return undefined;

  const hasFields = upFragments.length > 1 && downFragments.length > 1;
  const upstream = fragmentsToEndpoint(upFragments, hasFields);
  const downstream = fragmentsToEndpoint(downFragments, hasFields);
  if (!upstream || !downstream) return undefined;
  return { upstream, downstream };
}

/**
 * Split complex-variable fragments into schema/table/fields.
 * `hasFields` resolves the `a.b` ambiguity (schema.table vs table.field).
 */
function fragmentsToEndpoint (fragments: string[], hasFields: boolean): DepEndpointRef | undefined {
  if (fragments.length === 0) return undefined;
  if (!hasFields) {
    const tableName = fragments[fragments.length - 1];
    const schemaName = fragments.length > 1 ? fragments[fragments.length - 2] : null;
    return { schemaName, tableName, fieldNames: [] };
  }
  const fieldNames = [
    fragments[fragments.length - 1],
  ];
  const tableName = fragments[fragments.length - 2];
  const schemaName = fragments.length > 2 ? fragments[fragments.length - 3] : null;
  return { schemaName, tableName, fieldNames };
}

/** Extract dep edges from inline `[dep: -> target]` settings on a column. */
function extractInlineDepEdges (field: FunctionApplicationNode, host: DepEndpointRef): DepSyncEdge[] {
  const list = field.args.find((a) => a instanceof ListExpressionNode) as ListExpressionNode | undefined;
  if (!list) return [];

  const edges: DepSyncEdge[] = [];
  for (const attr of list.elementList) {
    if (extractSettingName(attr) !== SettingName.Dep) continue;
    const value = attr.value;
    if (!(value instanceof PrefixExpressionNode) || !value.expression) continue;
    const dir = value.op?.value;
    if (dir !== DEP_DOWNSTREAM && dir !== DEP_UPSTREAM) continue;
    const targetFragments = destructureComplexVariable(value.expression);
    if (!targetFragments) continue;
    const target = fragmentsToEndpoint(targetFragments, targetFragments.length > 1);
    if (!target) continue;
    edges.push(dir === DEP_DOWNSTREAM
      ? { upstream: host, downstream: target }
      : { upstream: target, downstream: host });
  }
  return edges;
}

function edgesMatch (candidate: DepSyncEdge, target: DepSyncEdge): boolean {
  return endpointMatches(candidate.upstream, target.upstream) && endpointMatches(candidate.downstream, target.downstream);
}

function blockHasEdge (block: DepBlock, edge: DepSyncEdge): boolean {
  return block.edges.some((e) => edgesMatch(e, edge));
}

function findBlockForEdge (blocks: DepBlock[], edge: DepSyncEdge): DepBlock | undefined {
  return blocks.find((b) => blockHasEdge(b, edge));
}

/** Dispatch a single sync operation to the appropriate edit strategy. */
function applyOperation (dbml: string, operation: DepSyncOperation, blocks: DepBlock[], inlineDeps: InlineDep[]): TextEdit[] {
  switch (operation.operation) {
    case 'create':
      return computeCreateEdit(dbml, operation, blocks, inlineDeps);
    case 'update': {
      const block = findBlockForEdge(blocks, operation.edge);
      return block ? computeUpdateEdit(operation, block, dbml) : [];
    }
    case 'remove': {
      const block = findBlockForEdge(blocks, operation.edge);
      return block ? computeUpdateEdit({ ...operation, color: undefined, note: undefined }, block, dbml) : [];
    }
    default:
      return [];
  }
}

/** Compute edits to update an existing block's color and/or note. */
function computeUpdateEdit (operation: DepSyncOperation, block: DepBlock, source: string): TextEdit[] {
  const edits: TextEdit[] = [];

  if (operation.color !== undefined) {
    const edit = updateSettingEdit(block.declaration, SettingName.Color, operation.color, source);
    if (edit) edits.push(edit);
  }

  if (operation.note === null) {
    const edit = removeNoteEdit(block.declaration);
    if (edit) edits.push(edit);
  } else if (operation.note !== undefined) {
    const edit = updateNoteEdit(block.declaration, operation.note) ?? addNoteEdit(block.declaration, operation.note);
    if (edit) edits.push(edit);
  }

  return edits;
}

/** Compute edits to create a new Dep block (or update if one already matches). */
function computeCreateEdit (dbml: string, operation: DepSyncOperation, blocks: DepBlock[], inlineDeps: InlineDep[]): TextEdit[] {
  const existing = findBlockForEdge(blocks, operation.edge);
  if (existing) return computeUpdateEdit(operation, existing, dbml);

  const newBlock = generateDepBlock(operation.edge, operation.color ?? '');
  const createEdit: TextEdit = { start: dbml.length, end: dbml.length, newText: '\n\n' + newBlock + '\n' };

  // If the edge is authored inline, strip the inline setting to avoid duplication.
  const inline = inlineDeps.find((d) => edgesMatch(d.edge, operation.edge));
  if (inline) {
    return [
      { start: inline.fullStart, end: inline.fullEnd, newText: '' },
      createEdit,
    ];
  }

  return [
    createEdit,
  ];
}
