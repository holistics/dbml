import {
  Hover, HoverProvider, TextModel, Position,
} from '@/services/types';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import Compiler from '@/compiler';
import { SyntaxNodeKind, ElementDeclarationNode } from '@/core/parser/nodes';
import { extractVariableFromExpression, getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { formatRecordsForHover, formatColumnValuesForHover } from './utils';

export default class DBMLHoverProvider implements HoverProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideHover (model: TextModel, position: Position): Hover | null {
    const offset = getOffsetFromMonacoPosition(model, position);
    const containers = [...this.compiler.container.stack(offset)];

    const rawDb = this.compiler.parse.rawDb();
    if (!rawDb) return null;

    while (containers.length !== 0) {
      const node = containers.pop();
      if (!node) continue;

      // Check if hovering over a table
      if (node.kind === SyntaxNodeKind.ELEMENT_DECLARATION) {
        const elementNode = node as ElementDeclarationNode;
        const elementKind = getElementKind(elementNode).unwrap_or(undefined);

        if (elementKind === ElementKind.Table) {
          const tableName = extractVariableFromExpression(elementNode.name).unwrap_or('');
          const table = rawDb.tables.find((t) => t.name === tableName);

          if (table) {
            const tableRecords = rawDb.records.find((r) => r.tableName === tableName);
            if (tableRecords && tableRecords.values.length > 0) {
              const markdown = formatRecordsForHover(table, tableRecords.values);
              return {
                contents: [{ value: markdown }],
              };
            }
          }
        }
      }

      // Check if hovering over a column (field declaration)
      if (node.kind === SyntaxNodeKind.ELEMENT_DECLARATION) {
        const fieldNode = node as ElementDeclarationNode;
        const parent = fieldNode.parent;

        if (parent instanceof ElementDeclarationNode) {
          const elementKind = getElementKind(parent).unwrap_or(undefined);

          if (elementKind === ElementKind.Table) {
            const tableName = extractVariableFromExpression(parent.name).unwrap_or('');
            const columnName = extractVariableFromExpression(fieldNode.name).unwrap_or('');

            const table = rawDb.tables.find((t) => t.name === tableName);
            if (table) {
              const tableRecords = rawDb.records.find((r) => r.tableName === tableName);
              const column = table.fields.find((f) => f.name === columnName);

              if (tableRecords && tableRecords.values.length > 0 && column) {
                const markdown = formatColumnValuesForHover(column, tableRecords.values, columnName);
                return {
                  contents: [{ value: markdown }],
                };
              }
            }
          }
        }
      }
    }

    return null;
  }
}
