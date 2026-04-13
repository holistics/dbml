import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { ElementKind } from '@/core/types/keywords';
import { DEFAULT_ENTRY, DEFAULT_SCHEMA_NAME } from '@/constants';
import { SyntaxNodeIdGenerator } from '@/core/types/nodes';
import { destructureComplexVariable } from '@/core/utils/expression';
import {
  applyTextEdits, TextEdit,
} from './applyTextEdits';
import { addDoubleQuoteIfNeeded } from '../utils';
import type { FilterConfig } from '@/core/types/schemaJson';

export interface DiagramViewCreateOperation {
  operation: 'create';
  name: string;
  visibleEntities: FilterConfig;
}

export interface DiagramViewUpdateOperation {
  operation: 'update';
  name: string;
  newName: string;
}

export interface DiagramViewDeleteOperation {
  operation: 'delete';
  name: string;
}

export type DiagramViewSyncOperation = DiagramViewCreateOperation | DiagramViewUpdateOperation | DiagramViewDeleteOperation;

interface DiagramViewBlock {
  name: string;
  nameStart: number;
  nameEnd: number;
  blockStart: number;
  blockEnd: number;
}

function findDiagramViewBlocks (source: string): DiagramViewBlock[] {
  const blocks: DiagramViewBlock[] = [];
  const lexerResult = new Lexer(source, DEFAULT_ENTRY).lex();
  if (lexerResult.getErrors().length > 0) return blocks;

  const tokens = lexerResult.getValue();
  const ast = new Parser(DEFAULT_ENTRY, source, tokens, new SyntaxNodeIdGenerator()).parse();
  if (ast.getErrors().length > 0) return blocks;

  const program = ast.getValue().ast;

  for (const element of program.declarations) {
    if (element.isKind(ElementKind.DiagramView)) {
      const fragments = element.name ? (destructureComplexVariable(element.name) ?? []) : [];
      const name = fragments.length > 0 ? fragments[fragments.length - 1] : '';
      blocks.push({
        name,
        nameStart: element.name?.start ?? element.start,
        nameEnd: element.name?.end ?? element.start,
        blockStart: element.start,
        blockEnd: element.end,
      });
    }
  }

  return blocks;
}

function buildBlock (name: string, ve: FilterConfig): string {
  const lines: string[] = [`DiagramView ${addDoubleQuoteIfNeeded(name)} {`];

  if (ve.tables !== null) {
    if (ve.tables.length === 0) {
      lines.push('  Tables { * }');
    } else {
      lines.push('  Tables {');
      ve.tables.forEach((t) => {
        const qualName = (t.schemaName && t.schemaName !== DEFAULT_SCHEMA_NAME)
          ? `${t.schemaName}.${t.name}`
          : t.name;
        lines.push(`    ${qualName}`);
      });
      lines.push('  }');
    }
  }

  if (ve.stickyNotes !== null) {
    if (ve.stickyNotes.length === 0) {
      lines.push('  Notes { * }');
    } else {
      lines.push('  Notes {');
      ve.stickyNotes.forEach((n) => lines.push(`    ${n.name}`));
      lines.push('  }');
    }
  }

  if (ve.tableGroups !== null) {
    if (ve.tableGroups.length === 0) {
      lines.push('  TableGroups { * }');
    } else {
      lines.push('  TableGroups {');
      ve.tableGroups.forEach((n) => lines.push(`    ${n.name}`));
      lines.push('  }');
    }
  }

  if (ve.schemas !== null) {
    if (ve.schemas.length === 0) {
      lines.push('  Schemas { * }');
    } else {
      lines.push('  Schemas {');
      ve.schemas.forEach((n) => lines.push(`    ${n.name}`));
      lines.push('  }');
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Applies a sequence of create / update / delete operations to a DBML string
 * and returns the updated string.  Operations are applied sequentially so that
 * later ops see the result of earlier ones (e.g. create then delete cancels out).
 *
 * - **create** is idempotent: if a block with the same name already exists it
 *   is replaced in-place; otherwise the new block is appended.
 * - **update** renames the name token of an existing block (no-op when not found).
 * - **delete** removes the entire block (no-op when not found).
 */
export function syncDiagramView (
  source: string,
  operations: DiagramViewSyncOperation[],
): { newDbml: string } {
  let result = source;

  for (const op of operations) {
    const blocks = findDiagramViewBlocks(result);
    const edits: TextEdit[] = [];

    switch (op.operation) {
      case 'create': {
        const existing = blocks.find((b) => b.name === op.name);
        if (existing) {
          edits.push({
            start: existing.blockStart,
            end: existing.blockEnd,
            newText: buildBlock(op.name, op.visibleEntities),
          });
        } else {
          const newBlock = buildBlock(op.name, op.visibleEntities);
          const separator = result.length > 0 && !result.endsWith('\n') ? '\n' : '';
          edits.push({
            start: result.length,
            end: result.length,
            newText: separator + newBlock,
          });
        }
        break;
      }

      case 'update': {
        const existing = blocks.find((b) => b.name === op.name);
        if (!existing) break;
        edits.push({
          start: existing.nameStart,
          end: existing.nameEnd,
          newText: addDoubleQuoteIfNeeded(op.newName),
        });
        break;
      }

      case 'delete': {
        const existing = blocks.find((b) => b.name === op.name);
        if (!existing) break;
        let deleteStart = existing.blockStart;
        if (deleteStart > 0 && result[deleteStart - 1] === '\n') {
          deleteStart--;
        }
        edits.push({
          start: deleteStart,
          end: existing.blockEnd,
          newText: '',
        });
        break;
      }
    }

    if (edits.length > 0) {
      result = applyTextEdits(result, edits, true);
    }
  }

  return { newDbml: result };
}
