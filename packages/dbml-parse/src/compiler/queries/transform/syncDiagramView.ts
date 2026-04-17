import {
  DEFAULT_ENTRY, DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  ElementKind,
} from '@/core/analyzer/types';
import {
  destructureComplexVariable,
} from '@/core/analyzer/utils';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import {
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import {
  addDoubleQuoteIfNeeded,
} from '../utils';
import {
  TextEdit, applyTextEdits,
} from './applyTextEdits';

export interface DiagramViewSyncOperation {
  operation: 'create' | 'update' | 'delete';
  name: string;
  newName?: string;
  visibleEntities?: {
    tables?: Array<{ name: string;
      schemaName: string; }> | null;
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

export function findDiagramViewBlocks (source: string): DiagramViewBlock[] {
  const blocks: DiagramViewBlock[] = [];
  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return blocks;

  const tokens = lexerResult.getValue();
  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
  if (ast.getErrors().length > 0) return blocks;

  const program = ast.getValue().ast;

  for (const element of program.body) {
    if (element.isKind(ElementKind.DiagramView)) {
      const fragments = element.name
        ? (destructureComplexVariable(element.name) ?? [])
        : [];
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

function emitTablesBlock (lines: string[], tables: Array<{
  name: string;
  schemaName: string;
}>): void {
  const tableNames = tables.map((t) => {
    const tableName = addDoubleQuoteIfNeeded(t.name);
    if (t.schemaName === DEFAULT_SCHEMA_NAME) return tableName;
    return `${addDoubleQuoteIfNeeded(t.schemaName)}.${tableName}`;
  });
  lines.push('  Tables {');
  tableNames.forEach((n) => lines.push(`    ${n}`));
  lines.push('  }');
}

function emitTableGroupsBlock (lines: string[], tableGroups: Array<{ name: string }>): void {
  lines.push('  TableGroups {');
  tableGroups.forEach((n) => lines.push(`    ${addDoubleQuoteIfNeeded(n.name)}`));
  lines.push('  }');
}

function emitSchemasBlock (lines: string[], schemas: Array<{ name: string }>): void {
  lines.push('  Schemas {');
  schemas.forEach((n) => lines.push(`    ${addDoubleQuoteIfNeeded(n.name)}`));
  lines.push('  }');
}

function emitNotesBlock (lines: string[], notes: Array<{ name: string }>): void {
  lines.push('  Notes {');
  notes.forEach((n) => lines.push(`    ${addDoubleQuoteIfNeeded(n.name)}`));
  lines.push('  }');
}

function generateDiagramViewBlock (
  name: string,
  visibleEntities: DiagramViewSyncOperation['visibleEntities'],
): string {
  const blockName = addDoubleQuoteIfNeeded(name);
  const header = `DiagramView ${blockName} {`;

  if (!visibleEntities) {
    return `${header}\n}`;
  }

  const {
    tables, tableGroups, schemas, stickyNotes,
  } = visibleEntities;

  const tablesIsNull = tables === null;
  const tableGroupsIsNull = tableGroups === null;
  const schemasIsNull = schemas === null;
  const notesIsNull = stickyNotes === null;

  // A1: All null → empty block
  if (tablesIsNull && tableGroupsIsNull && schemasIsNull && notesIsNull) {
    return `${header}\n}`;
  }

  // Any Trinity dim null?
  const anyTrinityNull = tablesIsNull || tableGroupsIsNull || schemasIsNull;

  if (anyTrinityNull) {
    const tablesHasItems = !tablesIsNull && tables!.length > 0;
    const tableGroupsHasItems = !tableGroupsIsNull && tableGroups!.length > 0;
    const schemasHasItems = !schemasIsNull && schemas!.length > 0;
    const anyTrinityHasItems = tablesHasItems || tableGroupsHasItems || schemasHasItems;

    if (!anyTrinityHasItems) {
      // No Trinity dims have items
      if (stickyNotes && stickyNotes.length > 0) {
        // Specific notes but no Trinity items → Notes { items }
        const lines: string[] = [
          header,
        ];
        emitNotesBlock(lines, stickyNotes);
        lines.push('}');
        return lines.join('\n');
      }
      // Rule 2: all Trinity null/empty + no notes → Notes { * }
      return `${header}\n  Notes { * }\n}`;
    }

    // Rule 3: null dims + items exist → union rule, omit null dims
    const lines: string[] = [
      header,
    ];
    if (tablesHasItems) emitTablesBlock(lines, tables!);
    if (tableGroupsHasItems) emitTableGroupsBlock(lines, tableGroups!);
    if (schemasHasItems) emitSchemasBlock(lines, schemas!);
    if (stickyNotes && stickyNotes.length > 0) emitNotesBlock(lines, stickyNotes);
    lines.push('}');
    return lines.join('\n');
  }

  // All Trinity dims are non-null arrays
  const tablesArr = tables as Array<{ name: string;
    schemaName: string; }>;
  const tableGroupsArr = tableGroups as Array<{ name: string }>;
  const schemasArr = schemas as Array<{ name: string }>;

  const allTrinityEmpty = tablesArr.length === 0 && tableGroupsArr.length === 0 && schemasArr.length === 0;
  const hasNotesItems = stickyNotes != null && stickyNotes.length > 0;

  if (allTrinityEmpty) {
    // Rule 4: body-level { * }, or Tables { * } + Notes if notes have items
    if (hasNotesItems) {
      const lines: string[] = [
        header,
        '  Tables { * }',
      ];
      emitNotesBlock(lines, stickyNotes!);
      lines.push('}');
      return lines.join('\n');
    }
    return `${header}\n  *\n}`;
  }

  // Rules 5 & 6: emit only dims with items, omit empty arrays
  const lines: string[] = [
    header,
  ];
  if (tablesArr.length > 0) emitTablesBlock(lines, tablesArr);
  if (tableGroupsArr.length > 0) emitTableGroupsBlock(lines, tableGroupsArr);
  if (schemasArr.length > 0) emitSchemasBlock(lines, schemasArr);
  if (hasNotesItems) emitNotesBlock(lines, stickyNotes!);
  lines.push('}');
  return lines.join('\n');
}

/**
 * Synchronizes DiagramView blocks in DBML source code.
 *
 * @param dbml - The original DBML source code
 * @param operations - Array of operations to apply (create, update, delete)
 * @param blocks - Optional pre-parsed blocks from findDiagramViewBlocks. If not provided, parses internally.
 * @returns Object containing the new DBML source code and the text edits applied
 */
export function syncDiagramView (
  dbml: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string;
  edits: TextEdit[]; } {
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
    // Check if the line before is blank — if not, stop
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
