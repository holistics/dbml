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
import { ElementKind } from '@/core/types/keywords';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import type { NormalExpressionNode } from '@/core/types/nodes';
import { destructureComplexVariable, extractStringFromIdentifierStream } from '@/core/utils/expression';
import type Compiler from '../../index';
import { addDoubleQuoteIfNeeded } from '../utils';
import { TextEdit, applyTextEdits } from './applyTextEdits';

/** One endpoint of a dep edge. `fieldNames` is empty for a table-level edge. */
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
  /** The edge that identifies the target block (table-level: empty fieldNames). */
  edge: DepSyncEdge;
  color?: string;
}

/**
 * A `color` setting found on a block.
 *
 * `kind` says how to overwrite it:
 *  - `attribute` -> replace just the `color: <hex>` attribute at `start..end`
 *    (inside a `[...]` list that may hold other settings).
 *  - `subDeclaration` -> replace the whole `color: <hex>` body line at
 *    `start..end`.
 */
interface ColorSetting {
  kind: 'attribute' | 'subDeclaration';
  start: number;
  end: number;
  /**
   * Range to delete when removing the color (revert to default). Wider than
   * `start..end`: for an attribute it swallows the whole enclosing `[...]` when
   * color is the sole setting, otherwise one adjacent comma; for a
   * sub-declaration it is the same as `start..end` (the whole body line).
   */
  stripStart: number;
  stripEnd: number;
}

export interface DepBlock {
  startIndex: number;
  endIndex: number;
  edges: DepSyncEdge[];
  /**
   * An existing header `[...]` attribute list (without a color setting), so a
   * color can be inserted into it instead of adding a second `[...]`.
   * Records the offset just before the list's closing `]`.
   */
  attributeListInsertAt?: number;
  attributeListIsEmpty?: boolean;
  /**
   * Offset of the block body `{` - where to add a header `[color: ...]` for a
   * block-form Dep that has no attribute list.
   */
  bodyOpenAt?: number;
  /**
   * End offset of a short-form (`Dep: a -> b`) body that has no setting list -
   * where to append ` [color: ...]`.
   */
  shortFormEnd?: number;
  /** The existing color setting (header list, inline list, or sub-declaration), if any. */
  color?: ColorSetting;
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

function endpointsEqual (a: DepEndpointRef, b: DepEndpointRef): boolean {
  if (normalizeSchema(a.schemaName) !== normalizeSchema(b.schemaName)) return false;
  if (a.tableName !== b.tableName) return false;
  const fa = a.fieldNames ?? [];
  const fb = b.fieldNames ?? [];
  if (fa.length !== fb.length) return false;
  return fa.every((f, i) => f === fb[i]);
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
  if (op !== '->' && op !== '<-') return undefined;
  const left = infix.leftExpression;
  const right = infix.rightExpression;
  if (!left || !right) return undefined;

  const upstreamNode = op === '<-' ? right : left;
  const downstreamNode = op === '<-' ? left : right;

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

/** Find a `color` attribute inside a `[...]` setting list, capturing its own range and a strip range. */
function colorFromAttributeList (list: ListExpressionNode): ColorSetting | undefined {
  const elements = list.elementList;
  for (let i = 0; i < elements.length; i += 1) {
    const attr = elements[i];
    if (attrName(attr) !== 'color' || !attr.value) continue;

    // Strip range: sole setting → the whole `[...]`; otherwise the attr plus one adjacent comma.
    let stripStart = attr.start;
    let stripEnd = attr.end;
    if (elements.length === 1) {
      stripStart = list.start;
      stripEnd = list.end;
    } else if (i < elements.length - 1) {
      stripEnd = elements[i + 1].start;
    } else {
      stripStart = elements[i - 1].end;
    }

    return {
      kind: 'attribute', start: attr.start, end: attr.end, stripStart, stripEnd,
    };
  }
  return undefined;
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
    let color: ColorSetting | undefined;
    let attributeListInsertAt: number | undefined;
    let attributeListIsEmpty: boolean | undefined;
    let bodyOpenAt: number | undefined;
    let shortFormEnd: number | undefined;

    // Header `[color: ...]`
    if (element.attributeList) {
      color = colorFromAttributeList(element.attributeList);
      if (!color && element.attributeList.listCloseBracket) {
        attributeListInsertAt = element.attributeList.listCloseBracket.start;
        attributeListIsEmpty = element.attributeList.elementList.length === 0;
      }
    }

    const body = element.body;
    if (body instanceof FunctionApplicationNode) {
      // short form: Dep: a -> b [setting]
      if (body.callee instanceof InfixExpressionNode) {
        const edge = edgeFromInfix(body.callee);
        if (edge) edges.push(edge);
      }
      const settingList = body.args.find((a) => a instanceof ListExpressionNode) as ListExpressionNode | undefined;
      if (settingList) {
        // Merge the color into the existing `[...]` (e.g. `[note: '…']`) rather than appending a
        // second setting block, which would be a syntax error.
        if (!color) color = colorFromAttributeList(settingList);
        if (!color && settingList.listCloseBracket) {
          attributeListInsertAt = settingList.listCloseBracket.start;
          attributeListIsEmpty = settingList.elementList.length === 0;
        }
      } else {
        shortFormEnd = element.end;
      }
    } else if (body) {
      bodyOpenAt = body.start;
      for (const field of body.body) {
        if (field instanceof FunctionApplicationNode && field.callee instanceof InfixExpressionNode) {
          const edge = edgeFromInfix(field.callee);
          if (edge) edges.push(edge);
          const settingList = field.args.find((a) => a instanceof ListExpressionNode) as ListExpressionNode | undefined;
          if (!color && settingList) color = colorFromAttributeList(settingList);
        } else if (field instanceof ElementDeclarationNode && field.type?.value?.toLowerCase() === 'color') {
          const subBody = field.body;
          if (subBody instanceof FunctionApplicationNode && subBody.callee) {
            color = {
              kind: 'subDeclaration', start: field.start, end: field.end, stripStart: field.start, stripEnd: field.end,
            };
          }
        }
      }
    }

    blocks.push({
      startIndex: element.start,
      endIndex: element.end,
      attributeListInsertAt,
      attributeListIsEmpty,
      bodyOpenAt,
      shortFormEnd,
      edges,
      color,
    });
  }

  return blocks;
}

export interface InlineDep {
  edge: DepSyncEdge;
  stripStart: number;
  stripEnd: number;
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
    const schemaName = tableFragments.length > 1 ? tableFragments[tableFragments.length - 2] : null;

    const body = element.body;
    if (!body || body instanceof FunctionApplicationNode) continue;
    for (const field of body.body) {
      if (!(field instanceof FunctionApplicationNode) || !field.callee) continue;
      const colFragments = destructureComplexVariable(field.callee) ?? [];
      const columnName = colFragments[colFragments.length - 1];
      if (!columnName) continue;
      const list = field.args.find((a) => a instanceof ListExpressionNode) as ListExpressionNode | undefined;
      if (!list) continue;

      const elements = list.elementList;
      for (let i = 0; i < elements.length; i += 1) {
        const attr = elements[i];
        if (attrName(attr) !== 'dep') continue;
        const value = attr.value;
        if (!(value instanceof PrefixExpressionNode) || !value.expression) continue;
        const dir = value.op?.value;
        if (dir !== '->' && dir !== '<-') continue;
        const targetFragments = destructureComplexVariable(value.expression);
        if (!targetFragments) continue;
        const host: DepEndpointRef = { schemaName,
          tableName,
          fieldNames: [
            columnName,
          ] };
        const target = fragmentsToEndpoint(targetFragments, targetFragments.length > 1);
        if (!target) continue;
        const edge: DepSyncEdge = dir === '->'
          ? { upstream: host, downstream: target }
          : { upstream: target, downstream: host };

        // Strip range: sole setting → the whole `[...]`; otherwise the attr plus one adjacent comma.
        let stripStart = attr.start;
        let stripEnd = attr.end;
        if (elements.length === 1) {
          stripStart = list.start;
          stripEnd = list.end;
        } else if (i < elements.length - 1) {
          stripEnd = elements[i + 1].start;
        } else {
          stripStart = elements[i - 1].end;
        }
        result.push({ edge, stripStart, stripEnd });
      }
    }
  }

  return result;
}

function formatEndpoint (endpoint: DepEndpointRef): string {
  const schema = normalizeSchema(endpoint.schemaName);
  const parts: string[] = [];
  if (schema !== DEFAULT_SCHEMA_NAME) parts.push(addDoubleQuoteIfNeeded(schema));
  parts.push(addDoubleQuoteIfNeeded(endpoint.tableName));
  for (const field of endpoint.fieldNames ?? []) parts.push(addDoubleQuoteIfNeeded(field));
  return parts.join('.');
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

function findBlockForEdge (blocks: DepBlock[], edge: DepSyncEdge): DepBlock | undefined {
  return blocks.find((b) => blockHasEdge(b, edge));
}

function computeUpdateEdit (operation: DepSyncOperation, block: DepBlock): TextEdit[] {
  const color = operation.color ?? '';

  if (block.color) {
    // Overwrite the existing color setting in place (just the `color: <hex>`).
    return [
      { start: block.color.start, end: block.color.end, newText: `color: ${color}` },
    ];
  }

  if (block.attributeListInsertAt !== undefined) {
    // Insert into the existing header `[...]` list, before its closing `]`.
    const sep = block.attributeListIsEmpty ? '' : ', ';
    return [
      { start: block.attributeListInsertAt, end: block.attributeListInsertAt, newText: `${sep}color: ${color}` },
    ];
  }

  if (block.bodyOpenAt !== undefined) {
    // Block form, no attribute list: insert a header `[color: ...]` before the body `{`.
    return [
      { start: block.bodyOpenAt, end: block.bodyOpenAt, newText: `[color: ${color}] ` },
    ];
  }

  if (block.shortFormEnd !== undefined) {
    // Short form (`Dep: a -> b`), no setting list: append ` [color: ...]`.
    return [
      { start: block.shortFormEnd, end: block.shortFormEnd, newText: ` [color: ${color}]` },
    ];
  }

  return [];
}

function computeCreateEdit (dbml: string, operation: DepSyncOperation, blocks: DepBlock[], inlineDeps: InlineDep[]): TextEdit[] {
  // An already-matching block is updated, never duplicated.
  const existing = findBlockForEdge(blocks, operation.edge);
  if (existing) return computeUpdateEdit(operation, existing);

  const newBlock = generateDepBlock(operation.edge, operation.color ?? '');
  const createEdit: TextEdit = { start: dbml.length, end: dbml.length, newText: '\n\n' + newBlock + '\n' };

  // If the edge is authored inline, strip the inline setting too — else the new block duplicates it.
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

function computeRemoveEdit (block: DepBlock): TextEdit[] {
  // No color setting to strip - nothing to do.
  if (!block.color) return [];
  return [
    { start: block.color.stripStart, end: block.color.stripEnd, newText: '' },
  ];
}

function applyOperation (dbml: string, operation: DepSyncOperation, blocks: DepBlock[], inlineDeps: InlineDep[]): TextEdit[] {
  switch (operation.operation) {
    case 'create':
      return computeCreateEdit(dbml, operation, blocks, inlineDeps);
    case 'update': {
      const block = findBlockForEdge(blocks, operation.edge);
      return block ? computeUpdateEdit(operation, block) : [];
    }
    case 'remove': {
      const block = findBlockForEdge(blocks, operation.edge);
      return block ? computeRemoveEdit(block) : [];
    }
    default:
      return [];
  }
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
