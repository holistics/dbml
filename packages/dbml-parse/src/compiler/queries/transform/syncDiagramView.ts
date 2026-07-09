/**
 * DiagramView block transform - read, write, and synchronise DiagramView
 * blocks in DBML source.
 *
 * Glossary
 * --------
 * - **dim** (dimension): one of the four fields in `visibleEntities` -
 *   `tables`, `tableGroups`, `schemas`, or `stickyNotes`. Each dim
 *   independently describes which entities of that kind should be visible
 *   in the DiagramView.
 * - **trinity**: the three table-related dims (`tables`, `tableGroups`,
 *   `schemas`). They share an interpreter rule (trinity-omit) and are
 *   handled as a group when emitting DBML.
 * - **notes**: shorthand for the `stickyNotes` dim. Independent of trinity
 *   in the interpreter - has its own emission rules.
 * - **dim state**: the three possible runtime shapes for a single dim's
 *   FilterConfig value (see {@link DimState}):
 *     - `'null'`  -> user explicitly hides all entities of this kind
 *     - `'empty'` -> user shows all entities of this kind (current + future)
 *     - `'items'` -> user shows a specific subset (the array carries the items)
 * - **sub-block**: a child block inside a DiagramView body, e.g.
 *   `Tables { users }` or `Notes { * }`. One sub-block per dim.
 * - **body-level wildcard**: the DBML form `DiagramView X { * }` - a `*`
 *   at the body level rather than inside a sub-block. The interpreter
 *   expands it to "show all" for ALL four dims simultaneously.
 * - **wildcard expansion** ({@link ../../../core/global_modules/diagramView/interpret.ts}):
 *   when `Tables { * }` or `Schemas { * }` is emitted, the interpreter sets
 *   all three trinity dims to `[]`. Notes is left at its default. Used here
 *   as a compact way to encode "show all trinity" without emitting three
 *   sub-blocks.
 * - **trinity-omit rule** (same file as wildcard expansion): when at least
 *   one trinity dim is explicitly non-null in the DBML, any omitted trinity
 *   dim is promoted from `null` to `[]` (show all). Lets us encode trinity
 *   `[]` by omitting the block - provided another trinity dim carries items.
 * - **round-trip**: the property that an input `visibleEntities` value,
 *   when emitted to DBML and then re-parsed, yields the same value. The
 *   writer's job is to preserve this for every UI-reachable input.
 */

import { DEFAULT_ENTRY, DEFAULT_SCHEMA_NAME } from '@/constants';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { Filepath } from '@/core/types/filepath';
import { ElementKind } from '@/core/types/keywords';
import { SyntaxNodeIdGenerator } from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import type Compiler from '../../index';
import { addDoubleQuoteIfNeeded } from '../utils';
import { TextEdit, applyTextEdits } from './applyTextEdits';

export interface DiagramViewSyncOperation {
  operation: 'create' | 'update' | 'delete';
  name: string;
  newName?: string;
  visibleEntities?: {
    tables?: Array<{
      name: string;
      schemaName: string;
    }> | null;
    stickyNotes?: Array<{ name: string }> | null;
    tableGroups?: Array<{ name: string }> | null;
    schemas?: Array<{ name: string }> | null;
  };
}

export interface DiagramViewBlock {
  name: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Returns the position of every DiagramView block in `source`
 * Note that onany lex or parse errors, we return [], as there's no reliable way to detect diagram views from malformed DBML
 */
export function findDiagramViewBlocks (source: string): DiagramViewBlock[] {
  const blocks: DiagramViewBlock[] = [];

  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return blocks; // Lex error, return
  const tokens = lexerResult.getValue();

  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return blocks; // Parse error, return

  const program = ast.getValue().ast;

  for (const element of program.declarations) {
    if (element.isKind(ElementKind.DiagramView)) {
      const fragments = element.name ? (destructureComplexVariable(element.name) ?? []) : [];
      const name = fragments.length > 0 ? fragments[fragments.length - 1] : '';
      blocks.push({
        name,
        startIndex: element.start,
        endIndex: element.end,
      });
    }
  }

  return blocks;
}

type SubBlockName = 'Tables' | 'TableGroups' | 'Schemas' | 'Notes';

/**
 * Emits one sub-block of the form:
 *
 *   <indent>BlockName {
 *   <indent><indent>item1
 *   <indent><indent>item2
 *   <indent>}
 */
function emitListSubBlock (
  lines: string[],
  blockName: SubBlockName,
  items: string[],
): void {
  lines.push(`  ${blockName} {`);
  items.forEach((item) => lines.push(`    ${item}`));
  lines.push('  }');
}

function emitWildcardSubBlock (lines: string[], blockName: SubBlockName): void {
  lines.push(`  ${blockName} { * }`);
}

/**
 * The three runtime states a single dim's FilterConfig value can hold.
 * See the file header glossary for the semantic meaning of each.
 */
type DimState = 'null' | 'empty' | 'items';

/**
 * Reduces a dim's FilterConfig value to its {@link DimState}.
 *
 * - `null` / `undefined`  -> `'null'`  (hide all)
 * - `[]`                  -> `'empty'` (show all)
 * - any non-empty array   -> `'items'` (show specific items)
 */
function classifyDim<T> (value: T[] | null | undefined): DimState {
  if (value == null) return 'null';
  if (value.length === 0) return 'empty';
  return 'items';
}

/**
 * DiagramView block emission contract.
 *
 * Terms (dim, trinity, notes, sub-block, body-level wildcard, wildcard
 * expansion, trinity-omit rule, round-trip) are defined in the file header
 * glossary. Read that first if any of them are unfamiliar.
 *
 * Each visibleEntities dim has three FilterConfig states (see {@link DimState}):
 * `'null'`, `'empty'`, `'items'`. The emission must round-trip through the
 * interpreter, which relies on three behaviours:
 *
 *   1. **Trinity-omit rule** - when any trinity dim is explicitly non-null,
 *      omitted trinity dims are promoted to `[]`. So omitting a trinity
 *      sub-block is the canonical encoding of `'empty'` when another trinity
 *      dim carries items.
 *   2. **Wildcard expansion** - `Tables { * }` or `Schemas { * }` sets all
 *      three trinity dims to `[]` and leaves stickyNotes untouched.
 *   3. **Body-level wildcard `{ * }`** - sets ALL four dims to `[]`,
 *      including stickyNotes. Used as a size shortcut only.
 *
 * Truth table (input -> emission -> round-trips to):
 *
 *   ┌────────────────────────────────────────┬───────────────────────────┐
 *   │ Input states                           │ Emission                  │
 *   ├────────────────────────────────────────┼───────────────────────────┤
 *   │ all four = null                        │ `{}`            shortcut  │
 *   │ all four = empty                       │ `{ * }`         shortcut  │
 *   │ all trinity empty, notes = null        │ `{ Tables { * } }`        │
 *   │ all trinity empty, notes = items       │ `{ Tables { * } + Notes }`│
 *   │ no trinity items, notes = empty        │ `{ Notes { * } }`         │
 *   │ no trinity items, notes = items        │ `{ Notes { items } }`     │
 *   │ no trinity items, notes = null         │ `{}` (interpreter default)│
 *   │ any trinity items, ...                 │ emit each trinity items   │
 *   │                                        │ + Notes if items; trinity │
 *   │                                        │ peers omitted (trinity-   │
 *   │                                        │ omit promotes to [])      │
 *   └────────────────────────────────────────┴───────────────────────────┘
 *
 * Known round-trip asymmetry (not currently UI-reachable in dbdiagram):
 * mixed `null`/`[]` across trinity dims while another trinity carries items
 * cannot preserve the `null` distinction - the trinity-omit rule forces it
 * to `[]` on parse. See __tests__/.../syncDiagramView.test.ts for the
 * exhaustive case coverage.
 */
function generateDiagramViewBlock (
  name: string,
  visibleEntities: DiagramViewSyncOperation['visibleEntities'],
): string {
  const header = `DiagramView ${addDoubleQuoteIfNeeded(name)} {`;
  const formatNamed = (item: { name: string }) => addDoubleQuoteIfNeeded(item.name);
  const formatTableRef = (item: { name: string; schemaName: string }) => {
    const tableName = addDoubleQuoteIfNeeded(item.name);
    if (item.schemaName === DEFAULT_SCHEMA_NAME) return tableName;
    return `${addDoubleQuoteIfNeeded(item.schemaName)}.${tableName}`;
  };
  const formatedTables = visibleEntities?.tables?.map(formatTableRef) ?? [];
  const formatedTableGroups = visibleEntities?.tableGroups?.map(formatNamed) ?? [];
  const formatedSchemas = visibleEntities?.schemas?.map(formatNamed) ?? [];
  const formatedNotes = visibleEntities?.stickyNotes?.map(formatNamed) ?? [];

  if (!visibleEntities) return `${header}\n}`;

  const states = {
    tables: classifyDim(visibleEntities.tables),
    tableGroups: classifyDim(visibleEntities.tableGroups),
    schemas: classifyDim(visibleEntities.schemas),
    stickyNotes: classifyDim(visibleEntities.stickyNotes),
  };

  // Body-level shortcuts
  const allNull = (Object.values(states) as DimState[]).every((s) => s === 'null');
  if (allNull) return `${header}\n}`;
  const allEmpty = (Object.values(states) as DimState[]).every((s) => s === 'empty');
  if (allEmpty) return `${header}\n  *\n}`;

  const anyTrinityItems = states.tables === 'items' || states.tableGroups === 'items' || states.schemas === 'items';
  const allTrinityEmpty = states.tables === 'empty' && states.tableGroups === 'empty' && states.schemas === 'empty';

  const lines: string[] = [
    header,
  ];

  // Trinity emission
  if (anyTrinityItems) {
    // Per-dim: emit only dims with items. Trinity-omit rule promotes omitted
    // peers to [] on parse; null peers cannot be preserved in this branch.
    if (states.tables === 'items') emitListSubBlock(lines, 'Tables', formatedTables);
    if (states.tableGroups === 'items') emitListSubBlock(lines, 'TableGroups', formatedTableGroups);
    if (states.schemas === 'items') emitListSubBlock(lines, 'Schemas', formatedSchemas);
  } else if (allTrinityEmpty) {
    emitWildcardSubBlock(lines, 'Tables');
  }

  // Notes emission is independent of trinity
  if (states.stickyNotes === 'items') {
    emitListSubBlock(lines, 'Notes', formatedNotes);
  } else if (states.stickyNotes === 'empty') {
    // Emit show-all only when no other dim already carries it.
    emitWildcardSubBlock(lines, 'Notes');
  }
  // states.stickyNotes === 'null' -> omit; interpreter default is null.

  lines.push('}');
  return lines.join('\n');
}

/**
 * Synchronizes DiagramView blocks in the DBML source at `filepath`.
 *
 * @param filepath   The file whose source should be rewritten. Source is
 *                   read from the compiler's project layout, which makes the
 *                   query multifile-aware.
 * @param operations Array of operations to apply (create, update, delete).
 * @param blocks     Optional pre-parsed blocks from findDiagramViewBlocks. If
 *                   not provided, parses internally.
 * @returns Object containing the new DBML source code and the text edits applied.
 */
export function syncDiagramView (
  this: Compiler,
  filepath: Filepath,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): {
  newDbml: string;
  edits: TextEdit[];
} {
  const dbml = this.getSource(filepath) ?? '';
  const originalBlocks = blocks ?? findDiagramViewBlocks(dbml);
  const allEdits: TextEdit[] = [];

  for (const op of operations) {
    const edits = applyOperation(dbml, op, originalBlocks);
    allEdits.push(...edits);
  }

  // Sort edits descending by start position for tail-first application
  allEdits.sort((a, b) => b.start - a.start);
  const newDbml = applyTextEdits(dbml, allEdits, true);
  return {
    newDbml,
    edits: allEdits,
  };
}

function applyOperation (
  dbml: string,
  operation: DiagramViewSyncOperation,
  blocks: DiagramViewBlock[],
): TextEdit[] {
  switch (operation.operation) {
    case 'create':
      return computeCreateEdit(dbml, operation, blocks);
    case 'update':
      return computeUpdateEdit(dbml, operation, blocks);
    case 'delete':
      return computeDeleteEdit(dbml, operation, blocks);
    default:
      return [];
  }
}

function computeCreateEdit (
  dbml: string,
  operation: DiagramViewSyncOperation,
  blocks: DiagramViewBlock[],
): TextEdit[] {
  // If a block with this name already exists, treat as update to avoid duplicate blocks
  const existing = blocks.find((b) => b.name === operation.name);
  if (existing) {
    return computeUpdateEdit(dbml, operation, blocks);
  }

  const newBlock = generateDiagramViewBlock(operation.name, operation.visibleEntities);
  const appendText = '\n\n' + newBlock + '\n';
  return [
    {
      start: dbml.length,
      end: dbml.length,
      newText: appendText,
    },
  ];
}

function computeUpdateEdit (
  dbml: string,
  operation: DiagramViewSyncOperation,
  blocks: DiagramViewBlock[],
): TextEdit[] {
  const block = blocks.find((b) => b.name === operation.name);
  if (!block) return [];

  const edits: TextEdit[] = [];

  if (operation.newName || operation.visibleEntities) {
    // Generate new block content
    const newName = operation.newName || operation.name;
    const newBlock = generateDiagramViewBlock(newName, operation.visibleEntities);

    // Replace entire block
    edits.push({
      start: block.startIndex,
      end: block.endIndex,
      newText: newBlock,
    });
  }

  return edits;
}

function computeDeleteEdit (
  dbml: string,
  operation: DiagramViewSyncOperation,
  blocks: DiagramViewBlock[],
): TextEdit[] {
  const block = blocks.find((b) => b.name === operation.name);
  if (!block) return [];

  // Expand range to include surrounding whitespace/newlines
  let start = block.startIndex;
  let end = block.endIndex;

  // Expand backwards to consume preceding blank lines
  while (start > 0 && dbml[start - 1] === '\n') {
    start--;
    // Also consume \r for CRLF
    if (start > 0 && dbml[start - 1] === '\r') {
      start--;
    }
    // Check if the line before is blank - if not, stop
    const prevLineStart = dbml.lastIndexOf('\n', start - 1) + 1;
    const prevLine = dbml.substring(prevLineStart, start);
    if (prevLine.trim() !== '') {
      // Not a blank line, restore position
      start = block.startIndex;
      // But still consume one newline before the block
      if (start > 0 && dbml[start - 1] === '\n') {
        start--;
        if (start > 0 && dbml[start - 1] === '\r') start--;
      }
      break;
    }
  }

  // Expand forward to consume trailing newline
  if (end < dbml.length && dbml[end] === '\r') end++;
  if (end < dbml.length && dbml[end] === '\n') end++;

  return [
    {
      start,
      end,
      newText: '',
    },
  ];
}
