import { applyTextEdits, TextEdit } from './applyTextEdits';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/analyzer/symbol/symbols';

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

interface DiagramViewBlock {
  name: string;
  startIndex: number;
  endIndex: number;
}

function findDiagramViewBlocks (source: string): DiagramViewBlock[] {
  const blocks: DiagramViewBlock[] = [];
  const lexerResult = new Lexer(source).lex();
  if (!lexerResult.isOk()) return blocks;

  const tokens = lexerResult.unwrap();
  const ast = new Parser(source, tokens, new SyntaxNodeIdGenerator()).parse();
  if (!ast.isOk()) return blocks;

  const program = ast.unwrap().ast;

  for (const element of program.body) {
    if (element.type?.value === 'DiagramView') {
      const name = element.name?.toString() || '';
      blocks.push({
        name,
        startIndex: element.start,
        endIndex: element.end,
      });
    }
  }

  return blocks;
}

function generateDiagramViewBlock (
  name: string,
  visibleEntities: DiagramViewSyncOperation['visibleEntities'],
): string {
  const lines: string[] = [`DiagramView ${name} {`];

  // Tables
  if (visibleEntities?.tables !== undefined) {
    if (visibleEntities.tables === null) {
      // Hide all - don't add block
    } else if (visibleEntities.tables.length === 0) {
      lines.push('  Tables { * }');
    } else {
      const tableNames = visibleEntities.tables.map((t) =>
        t.schemaName === 'public' ? t.name : `${t.schemaName}.${t.name}`,
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
 * @returns Object containing the new DBML source code
 */
export function syncDiagramView (
  dbml: string,
  operations: DiagramViewSyncOperation[],
): { newDbml: string } {
  let currentDbml = dbml;

  for (const op of operations) {
    currentDbml = applyOperation(currentDbml, op);
  }

  return { newDbml: currentDbml };
}

function applyOperation (dbml: string, operation: DiagramViewSyncOperation): string {
  switch (operation.operation) {
    case 'create':
      return applyCreate(dbml, operation);
    case 'update': {
      const blocks = findDiagramViewBlocks(dbml);
      return applyUpdate(dbml, operation, blocks);
    }
    case 'delete': {
      const blocks = findDiagramViewBlocks(dbml);
      return applyDelete(dbml, operation, blocks);
    }
    default:
      return dbml;
  }
}

function applyCreate (dbml: string, operation: DiagramViewSyncOperation): string {
  const newBlock = generateDiagramViewBlock(operation.name, operation.visibleEntities);

  // Append at end of file
  return dbml.trimEnd() + '\n\n' + newBlock + '\n';
}

function applyUpdate (
  dbml: string,
  operation: DiagramViewSyncOperation,
  blocks: DiagramViewBlock[],
): string {
  const block = blocks.find((b) => b.name === operation.name);
  if (!block) return dbml;

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

  return applyTextEdits(dbml, edits);
}

function applyDelete (
  dbml: string,
  operation: DiagramViewSyncOperation,
  blocks: DiagramViewBlock[],
): string {
  const block = blocks.find((b) => b.name === operation.name);
  if (!block) return dbml;

  // Remove block and surrounding whitespace
  const lines = dbml.split('\n');
  let startLine = 0;
  let endLine = lines.length - 1;

  // Find line boundaries
  let currentPos = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineStart = currentPos;
    const lineEnd = currentPos + lines[i].length;

    if (lineStart <= block.startIndex && block.startIndex <= lineEnd) {
      startLine = i;
    }
    if (lineStart <= block.endIndex && block.endIndex <= lineEnd) {
      endLine = i;
    }

    currentPos = lineEnd + 1; // +1 for newline
  }

  // Remove lines and clean up extra blank lines
  const newLines = [
    ...lines.slice(0, startLine),
    ...lines.slice(endLine + 1),
  ];

  return newLines.join('\n');
}
