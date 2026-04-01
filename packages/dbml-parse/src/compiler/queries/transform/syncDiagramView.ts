import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { ElementKind } from '@/core/analyzer/types';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { applyTextEdits, TextEdit } from './applyTextEdits';
import { addDoubleQuoteIfNeeded } from '../utils';

export interface DiagramViewSyncOperation {
  operation: 'create' | 'update' | 'delete';
  name: string;
  newName?: string;
  visibleEntities?: {
    tables?: Array<{ name: string; schemaName: string }> | null;
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
  const lexerResult = new Lexer(source).lex();
  if (lexerResult.getErrors().length > 0) return blocks;

  const tokens = lexerResult.getValue();
  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator()).parse();
  if (ast.getErrors().length > 0) return blocks;

  const program = ast.getValue().ast;

  for (const element of program.body) {
    if (element.type?.value === ElementKind.DiagramView) {
      const fragments = element.name
        ? destructureComplexVariable(element.name).unwrap_or([])
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

/** Returns true if the name requires double-quote wrapping in DBML. */
function needsQuoting (name: string): boolean {
  return !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function generateDiagramViewBlock (
  name: string,
  visibleEntities: DiagramViewSyncOperation['visibleEntities'],
): string {
  const lines: string[] = [`DiagramView ${addDoubleQuoteIfNeeded(name)} {`];

  // Tables
  if (visibleEntities?.tables !== undefined) {
    if (visibleEntities.tables === null) {
      // Hide all - don't add block
    } else if (visibleEntities.tables.length === 0) {
      lines.push('  Tables { * }');
    } else {
      const tableNames = visibleEntities.tables.map((t) =>
        t.schemaName === DEFAULT_SCHEMA_NAME ? t.name : `${t.schemaName}.${t.name}`,
      );
      lines.push('  Tables {');
      tableNames.forEach((n) => lines.push(`    ${n}`));
      lines.push('  }');
    }
  }

  // Notes
  if (visibleEntities?.stickyNotes !== undefined) {
    if (visibleEntities.stickyNotes === null) {
      // Hide all - don't add block
    } else if (visibleEntities.stickyNotes.length === 0) {
      lines.push('  Notes { * }');
    } else {
      lines.push('  Notes {');
      visibleEntities.stickyNotes.forEach((n) => lines.push(`    ${n.name}`));
      lines.push('  }');
    }
  }

  // TableGroups
  if (visibleEntities?.tableGroups !== undefined) {
    if (visibleEntities.tableGroups === null) {
      // Hide all - don't add block
    } else if (visibleEntities.tableGroups.length === 0) {
      lines.push('  TableGroups { * }');
    } else {
      lines.push('  TableGroups {');
      visibleEntities.tableGroups.forEach((n) => lines.push(`    ${n.name}`));
      lines.push('  }');
    }
  }

  // Schemas
  if (visibleEntities?.schemas !== undefined) {
    if (visibleEntities.schemas === null) {
      // Hide all - don't add block
    } else if (visibleEntities.schemas.length === 0) {
      lines.push('  Schemas { * }');
    } else {
      lines.push('  Schemas {');
      visibleEntities.schemas.forEach((n) => lines.push(`    ${n.name}`));
      lines.push('  }');
    }
  }

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
): { newDbml: string; edits: TextEdit[] } {
  const originalBlocks = blocks ?? findDiagramViewBlocks(dbml);
  const allEdits: TextEdit[] = [];

  for (const op of operations) {
    const edits = applyOperation(dbml, op, originalBlocks);
    allEdits.push(...edits);
  }

  // Sort edits descending by start position for tail-first application
  allEdits.sort((a, b) => b.start - a.start);
  const newDbml = applyTextEdits(dbml, allEdits, true);
  return { newDbml, edits: allEdits };
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
  return [{
    start: dbml.length,
    end: dbml.length,
    newText: appendText,
  }];
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

  return [{ start, end, newText: '' }];
}
