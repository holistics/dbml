import Compiler, { ScopeKind } from '@/compiler';
import {
  type InlineCompletionItemProvider,
  type TextModel,
  type Position,
  type InlineCompletions,
} from '@/services/types';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import { ElementDeclarationNode, FunctionApplicationNode, BlockExpressionNode, ProgramNode, CallExpressionNode, TupleExpressionNode } from '@/core/parser/nodes';
import { extractReferee, extractVariableFromExpression, getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { extractColumnNameAndType } from './utils';
import { getColumnsFromTableSymbol, isOffsetWithinElementHeader } from '@/services/suggestions/utils';
import { ColumnSymbol, TablePartialInjectedColumnSymbol } from '@/core/analyzer/symbol/symbols';

export default class DBMLInlineCompletionItemProvider implements InlineCompletionItemProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideInlineCompletions (model: TextModel, position: Position): InlineCompletions | null {
    const offset = getOffsetFromMonacoPosition(model, position);
    const scopeKind = this.compiler.container.scopeKind(offset);

    // Only provide inline completions in RECORDS scope
    if (scopeKind !== ScopeKind.RECORDS) {
      return null;
    }

    // Check if we're in a Records element and inside the body
    const element = this.compiler.container.element(offset);
    if (!(element instanceof ElementDeclarationNode)) {
      return null;
    }

    const elementKind = getElementKind(element).unwrap_or(undefined);
    if (elementKind !== ElementKind.Records || !(element.body instanceof BlockExpressionNode)) {
      return null;
    }
    // Check if we're outside any function application but inside the body
    // This means we're ready to type a new record entry
    if (isOffsetWithinElementHeader(offset, element)) return null;

    // Check if cursor is at the start of a line (only whitespace before it)
    const lineContent = model.getLineContent(position.lineNumber);
    const textBeforeCursor = lineContent.substring(0, position.column - 1);
    if (textBeforeCursor.trim() !== '') {
      return null;
    }

    if (element.parent instanceof ProgramNode) {
      return suggestInTopLevelRecords(this.compiler, element, position);
    } else {
      return suggestInNestedRecords(this.compiler, element, position);
    }
  }

  // Required by Monaco's InlineCompletionsProvider interface
  freeInlineCompletions (_completions: InlineCompletions): void {
    // No cleanup needed for our simple implementation
  }
}
function suggestInTopLevelRecords (compiler: Compiler, recordsElement: ElementDeclarationNode, position: Position): InlineCompletions | null {
  // Top-level Records only work with explicit column list: Records users(id, name) { }
  if (!(recordsElement.name instanceof CallExpressionNode)) return null;

  const columnElements = recordsElement.name.argumentList?.elementList || [];
  const columnSymbols = columnElements.map((e) => extractReferee(e));
  if (!columnSymbols || columnSymbols.length === 0) return null;

  const columns = columnElements
    .map((element, index) => {
      const symbol = columnSymbols[index];
      if (!symbol || !(symbol instanceof ColumnSymbol || symbol instanceof TablePartialInjectedColumnSymbol)) {
        return null;
      }
      const columnName = extractVariableFromExpression(element).unwrap_or(undefined);
      const result = extractColumnNameAndType(symbol, columnName);
      return result;
    })
    .filter((col) => col !== null) as Array<{ name: string; type: string }>;

  if (columns.length === 0) return null;

  // Generate the snippet with tab stops for inline completion
  const snippet = columns.map((col, index) => `\${${index + 1}:${col.name} (${col.type})}`).join(', ');

  return {
    items: [
      {
        insertText: { snippet },
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      },
    ],
  };
}

function suggestInNestedRecords (compiler: Compiler, recordsElement: ElementDeclarationNode, position: Position): InlineCompletions | null {
  // Get parent table element
  const parent = recordsElement.parent;
  if (!(parent instanceof ElementDeclarationNode)) {
    return null;
  }

  const parentKind = getElementKind(parent).unwrap_or(undefined);
  if (parentKind !== ElementKind.Table) {
    return null;
  }

  const tableSymbol = parent.symbol;
  if (!tableSymbol?.symbolTable) {
    return null;
  }

  let columns: Array<{ name: string; type: string }>;

  if (recordsElement.name instanceof TupleExpressionNode) {
    // Explicit columns from tuple: records (col1, col2)
    const columnElements = recordsElement.name.elementList;
    const columnSymbols = columnElements
      .map((e) => extractReferee(e))
      .filter((s) => s !== undefined);

    columns = columnElements
      .map((element, index) => {
        const symbol = columnSymbols[index];
        if (!symbol || !(symbol instanceof ColumnSymbol || symbol instanceof TablePartialInjectedColumnSymbol)) {
          return null;
        }
        const columnName = extractVariableFromExpression(element).unwrap_or(undefined);
        return extractColumnNameAndType(symbol, columnName);
      })
      .filter((col) => col !== null) as Array<{ name: string; type: string }>;
  } else {
    // Implicit columns - use all columns from parent table
    const result = getColumnsFromTableSymbol(tableSymbol, compiler);
    if (!result) {
      return null;
    }
    columns = result;
  }

  if (columns.length === 0) {
    return null;
  }

  // Generate the snippet with tab stops for inline completion
  const snippet = columns.map((col, index) => `\${${index + 1}:${col.name} (${col.type})}`).join(', ');

  return {
    items: [
      {
        insertText: { snippet },
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      },
    ],
  };
}
