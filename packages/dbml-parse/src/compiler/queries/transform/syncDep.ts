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

import { DEFAULT_ENTRY, DEFAULT_SCHEMA_NAME } from '@/constants';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { Filepath } from '@/core/types/filepath';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { DEP_DOWNSTREAM, DEP_UPSTREAM } from '@/core/types/schemaJson';
import {
  AttributeNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import { destructureComplexVariable, extractStringFromIdentifierStream } from '@/core/utils/expression';
import type Compiler from '../../index';
import { addDoubleQuoteIfNeeded } from '../utils';
import { endpointsEqual } from './utils';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import { updateNoteEdit, removeNoteEdit, addNoteEdit } from '@/core/utils/note';
import { updateSettingEdit, removeSettingEdit } from '@/core/utils/setting';

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
  stripStart: number;
  stripEnd: number;
}

/**
 * Returns every `Dep` block in `source`.
 * On any lex or parse error, returns [] - there is no reliable way to read
 * dep blocks from malformed DBML (mirrors findDiagramViewBlocks).
 */
export function findDepBlocks (source: string): DepBlock[] {
  const blocks: DepBlock[] = [];

  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return blocks;
  const tokens = lexerResult.getValue();

  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return blocks;

  const program = ast.getValue().ast;

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

// Inline deps (`Table a { x [dep: -> b.y] }`) have no `Dep` block. To color one we strip the inline
// setting and create a real block in the same pass, so the edge isn't duplicated.
export function findInlineDeps (source: string): InlineDep[] {
  const result: InlineDep[] = [];

  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return result;
  const tokens = lexerResult.getValue();

  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return result;
  const program = ast.getValue().ast;

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
      // Compute the strip range once per field - all dep edges on this field share the same setting removal
      const edit = removeSettingEdit(field, SettingName.Dep, source);
      if (!edit) continue;
      for (const dep of extractInlineDepEdges(field, host)) {
        result.push({ edge: dep, stripStart: edit.start, stripEnd: edit.end });
      }
    }
  }

  return result;
}

/**
 * Emit a `Dep` block for one edge with a `[color]` setting:
 *
 *   Dep [color: <hex>] {
 *     <upstream> -> <downstream>
 *   }
 */
export function generateDepBlock (edge: DepSyncEdge, color: string): string {
  const up = formatEndpoint(edge.upstream);
  const down = formatEndpoint(edge.downstream);
  return `Dep [color: ${color}] {\n  ${up} -> ${down}\n}`;
}

/**
 * Synchronizes `Dep` blocks in the DBML source at `filepath`.
 *
 * @param filepath   The file whose source should be rewritten.
 * @param operations Array of create/update operations to apply.
 * @param blocks     Optional pre-parsed blocks from findDepBlocks.
 * @returns The new DBML source and the text edits applied.
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
  const originalBlocks = blocks ?? findDepBlocks(dbml);
  const inlineDeps = findInlineDeps(dbml);
  const allEdits: TextEdit[] = [];

  for (const op of operations) {
    allEdits.push(...applyOperation(dbml, op, originalBlocks, inlineDeps));
  }

  allEdits.sort((a, b) => b.start - a.start);
  const newDbml = applyTextEdits(dbml, allEdits, true);
  return { newDbml, edits: allEdits };
}

function normalizeSchema (schema?: string | null): string {
  return schema && schema.length > 0 ? schema : DEFAULT_SCHEMA_NAME;
}

/**
 * Split an endpoint's complex-variable fragments into schema/table/fields.
 *
 * Fragments are `[schema?, table, ...fields]`. The leading-schema vs.
 * table-level ambiguity (`a.b` could be schema.table or table.field) is
 * resolved by `hasFields`: a table-level endpoint never has fields, so its
 * fragments are at most `[schema, table]`; a column endpoint ends in fields.
 */
function fragmentsToEndpoint (fragments: string[], hasFields: boolean): DepEndpointRef | undefined {
  if (fragments.length === 0) return undefined;
  if (!hasFields) {
    // [table] or [schema, table]
    const tableName = fragments[fragments.length - 1];
    const schemaName = fragments.length > 1 ? fragments[fragments.length - 2] : null;
    return { schemaName, tableName, fieldNames: [] };
  }
  // column endpoint: [table, field] or [schema, table, field]
  const fieldNames = [
    fragments[fragments.length - 1],
  ];
  const tableName = fragments[fragments.length - 2];
  const schemaName = fragments.length > 2 ? fragments[fragments.length - 3] : null;
  return { schemaName, tableName, fieldNames };
}

function edgesEqual (a: DepSyncEdge, b: DepSyncEdge): boolean {
  return endpointsEqual(a.upstream, b.upstream) && endpointsEqual(a.downstream, b.downstream);
}

function blockHasEdge (block: DepBlock, edge: DepSyncEdge): boolean {
  return block.edges.some((e) => edgesEqual(e, edge));
}

/** Extract one edge's endpoints from a body `a -> b` / `a <- b` infix node. */
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

  // A column edge has fields on at least one side; both sides share that level.
  const hasFields = upFragments.length > 1 && downFragments.length > 1;
  const upstream = fragmentsToEndpoint(upFragments, hasFields);
  const downstream = fragmentsToEndpoint(downFragments, hasFields);
  if (!upstream || !downstream) return undefined;
  return { upstream, downstream };
}

function attrName (attr: AttributeNode): string | undefined {
  if (attr.name instanceof IdentifierStreamNode) {
    return extractStringFromIdentifierStream(attr.name)?.toLowerCase();
  }
  return undefined;
}

function formatEndpoint (endpoint: DepEndpointRef): string {
  const schema = normalizeSchema(endpoint.schemaName);
  const parts: string[] = [];
  if (schema !== DEFAULT_SCHEMA_NAME) parts.push(addDoubleQuoteIfNeeded(schema));
  parts.push(addDoubleQuoteIfNeeded(endpoint.tableName));
  for (const field of endpoint.fieldNames ?? []) parts.push(addDoubleQuoteIfNeeded(field));
  return parts.join('.');
}

function findBlockForEdge (blocks: DepBlock[], edge: DepSyncEdge): DepBlock | undefined {
  return blocks.find((b) => blockHasEdge(b, edge));
}

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

function computeCreateEdit (dbml: string, operation: DepSyncOperation, blocks: DepBlock[], inlineDeps: InlineDep[]): TextEdit[] {
  // An already-matching block is updated, never duplicated.
  const existing = findBlockForEdge(blocks, operation.edge);
  if (existing) return computeUpdateEdit(operation, existing, dbml);

  const newBlock = generateDepBlock(operation.edge, operation.color ?? '');
  const createEdit: TextEdit = { start: dbml.length, end: dbml.length, newText: '\n\n' + newBlock + '\n' };

  // If the edge is authored inline, strip the inline setting too - else the new block duplicates it.
  const inline = inlineDeps.find((d) => edgesEqual(d.edge, operation.edge));
  if (inline) {
    return [
      { start: inline.stripStart, end: inline.stripEnd, newText: '' },
      createEdit,
    ];
  }

  return [
    createEdit,
  ];
}

function computeRemoveEdit (operation: DepSyncOperation, block: DepBlock, source: string): TextEdit[] {
  // When neither color nor note is specified, default to removing color (backward compat)
  const nothingSpecified = operation.color === undefined && operation.note === undefined;
  return computeUpdateEdit({
    ...operation,
    color: nothingSpecified ? null : operation.color,
  }, block, source);
}

/** Extract dep edges from inline `[dep: -> target]` settings on a column declaration. */
function extractInlineDepEdges (field: FunctionApplicationNode, host: DepEndpointRef): DepSyncEdge[] {
  const list = field.args.find((a) => a instanceof ListExpressionNode) as ListExpressionNode | undefined;
  if (!list) return [];

  const edges: DepSyncEdge[] = [];
  for (const attr of list.elementList) {
    if (attrName(attr) !== SettingName.Dep) continue;
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
      return block ? computeRemoveEdit(operation, block, dbml) : [];
    }
    default:
      return [];
  }
}
