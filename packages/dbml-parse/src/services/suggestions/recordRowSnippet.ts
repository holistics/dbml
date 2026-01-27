import {
  extractReferee,
  extractVariableFromExpression,
  getElementKind,
} from '@/core/analyzer/utils';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ProgramNode,
  TupleExpressionNode,
} from '@/core/parser/nodes';
import {
  type CompletionList,
  type TextModel,
  type Position,
  CompletionItemKind,
  CompletionItemInsertTextRule,
} from '@/services/types';
import { ColumnSymbol, TablePartialInjectedColumnSymbol, TableSymbol } from '@/core/analyzer/symbol/symbols';
import { ElementKind } from '@/core/analyzer/types';
import Compiler from '@/compiler';
import {
  noSuggestions,
  isOffsetWithinElementHeader,
  getColumnsFromTableSymbol,
  extractColumnNameAndType,
} from '@/services/suggestions/utils';
import { isOffsetWithinSpan } from '@/core/utils';

const FALLTHROUGH = Symbol('fallthrough');

export function suggestRecordRowSnippet (
  compiler: Compiler,
  model: TextModel,
  position: Position,
  offset: number,
): CompletionList | null | typeof FALLTHROUGH {
  const element = compiler.container.element(offset);

  // If not in an ElementDeclarationNode, fallthrough
  if (!(element instanceof ElementDeclarationNode)) {
    return FALLTHROUGH;
  }

  const elementKind = getElementKind(element).unwrap_or(undefined);

  // If not in a Records element, fallthrough
  if (elementKind !== ElementKind.Records || !(element.body instanceof BlockExpressionNode)) {
    return FALLTHROUGH;
  }

  // If we're in the header (not the body), fallthrough
  if (isOffsetWithinElementHeader(offset, element)) {
    return FALLTHROUGH;
  }

  // If we're not within the body, fallthrough
  if (!element.body || !isOffsetWithinSpan(offset, element.body)) {
    return FALLTHROUGH;
  }

  // Check if cursor is at the start of a line (only whitespace before it)
  const lineContent = model.getLineContent(position.lineNumber);
  if (lineContent.trim() !== '') {
    // Not on an empty line - fallthrough to allow other completions in Records body
    return FALLTHROUGH;
  }

  // On an empty line in Records body - provide record row snippet
  if (element.parent instanceof ProgramNode) {
    return suggestRecordRowInTopLevelRecords(compiler, element);
  } else {
    return suggestRecordRowInNestedRecords(compiler, element);
  }
}

export { FALLTHROUGH };

function suggestRecordRowInTopLevelRecords (
  compiler: Compiler,
  recordsElement: ElementDeclarationNode,
): CompletionList {
  // Top-level Records only work with explicit column list: Records users(id, name) { }
  if (!(recordsElement.name instanceof CallExpressionNode)) return noSuggestions();

  const columnElements = recordsElement.name.argumentList?.elementList || [];
  const columnSymbols = columnElements.map((e) => extractReferee(e));
  if (!columnSymbols || columnSymbols.length === 0) return noSuggestions();

  const columns = columnElements
    .map((element, index) => {
      const symbol = columnSymbols[index];
      if (!symbol || !(symbol instanceof ColumnSymbol || symbol instanceof TablePartialInjectedColumnSymbol)) {
        return null;
      }
      const columnName = extractVariableFromExpression(element).unwrap_or(undefined);
      if (!columnName) return null;
      const result = extractColumnNameAndType(symbol, columnName);
      return result;
    })
    .filter((col) => col !== null) as Array<{ name: string; type: string }>;

  if (columns.length === 0) return noSuggestions();

  // Generate the snippet with tab stops for completion
  const snippet = columns.map((col, index) => `\${${index + 1}:${col.name} (${col.type})}`).join(', ');

  return {
    suggestions: [
      {
        label: 'Record row snippet',
        insertText: snippet,
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        kind: CompletionItemKind.Snippet,
        range: undefined as any,
      },
    ],
  };
}

function suggestRecordRowInNestedRecords (
  compiler: Compiler,
  recordsElement: ElementDeclarationNode,
): CompletionList {
  // Get parent table element
  const parent = recordsElement.parent;
  if (!(parent instanceof ElementDeclarationNode)) {
    return noSuggestions();
  }

  const tableSymbol = parent.symbol;
  if (!(tableSymbol instanceof TableSymbol)) {
    return noSuggestions();
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
        if (columnName === undefined) return null;
        return extractColumnNameAndType(symbol, columnName);
      })
      .filter((col) => col !== null) as Array<{ name: string; type: string }>;
  } else {
    // Implicit columns - use all columns from parent table
    const result = getColumnsFromTableSymbol(tableSymbol);
    if (!result) {
      return noSuggestions();
    }
    columns = result;
  }

  if (columns.length === 0) {
    return noSuggestions();
  }

  // Generate the snippet with tab stops for completion
  const snippet = columns.map((col, index) => `\${${index + 1}:${col.name} (${col.type})}`).join(', ');

  return {
    suggestions: [
      {
        label: 'Record row snippet',
        insertText: snippet,
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        kind: CompletionItemKind.Snippet,
        range: undefined as any,
      },
    ],
  };
}
