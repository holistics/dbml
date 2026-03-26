import {
  extractVariableFromExpression,
  getElementKind,
} from '@/core/utils';
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
import { ColumnSymbol, TablePartialInjectedColumnSymbol, TableSymbol } from '@/core/analyzer/validator/symbol/symbols';
import { ElementKind } from '@/core/types';
import Compiler from '@/compiler';
import type { Filepath } from '@/compiler/projectLayout';
import { extractReferee, getFilepathFromModel } from '@/services/utils';
import {
  noSuggestions,
  getColumnsFromTableSymbol,
  extractNameAndTypeOfColumnSymbol,
} from '@/services/suggestions/utils';
import { isOffsetWithinSpan } from '@/core/utils';

export function suggestRecordRowSnippet (
  compiler: Compiler,
  model: TextModel,
  position: Position,
  offset: number,
): CompletionList | null {
  const filepath = getFilepathFromModel(model);
  const element = compiler.container.element(offset, filepath);

  if (!(element instanceof ElementDeclarationNode)) return null;

  const elementKind = getElementKind(element).unwrap_or(undefined);
  if (elementKind !== ElementKind.Records || !(element.body instanceof BlockExpressionNode)) return null;
  if (!element.body || !isOffsetWithinSpan(offset, element.body)) return null;

  const lineContent = model.getLineContent(position.lineNumber);
  if (lineContent.trim() !== '') return null;

  // On an empty line in Records body - provide record row snippet
  if (element.parent instanceof ProgramNode) {
    return suggestRecordRowInTopLevelRecords(compiler, element, filepath);
  } else {
    return suggestRecordRowInNestedRecords(compiler, element, filepath);
  }
}

function suggestRecordRowInTopLevelRecords (
  compiler: Compiler,
  recordsElement: ElementDeclarationNode,
  filepath: Filepath,
): CompletionList {
  // Top-level Records only work with explicit column list: Records users(id, name) { }
  if (!(recordsElement.name instanceof CallExpressionNode)) return noSuggestions();

  const columnElements = recordsElement.name.argumentList?.elementList || [];
  const columnSymbols = columnElements.map((e) => extractReferee(compiler, filepath, e));
  if (!columnSymbols || columnSymbols.length === 0) return noSuggestions();

  const columns = columnElements
    .map((element, index) => {
      const symbol = columnSymbols[index];
      if (!symbol || !(symbol instanceof ColumnSymbol || symbol instanceof TablePartialInjectedColumnSymbol)) {
        return null;
      }
      const columnName = extractVariableFromExpression(element).unwrap_or(undefined);
      if (!columnName) return null;
      const result = extractNameAndTypeOfColumnSymbol(symbol, columnName);
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
  filepath: Filepath,
): CompletionList {
  // Get parent table element
  const parent = recordsElement.parent;
  if (!(parent instanceof ElementDeclarationNode)) {
    return noSuggestions();
  }

  const tableSymbol = compiler.resolvedSymbol(parent, filepath);
  if (!(tableSymbol instanceof TableSymbol)) {
    return noSuggestions();
  }

  let columns: Array<{ name: string; type: string }>;

  if (recordsElement.name instanceof TupleExpressionNode) {
    // Explicit columns from tuple: records (col1, col2)
    const columnElements = recordsElement.name.elementList;
    const columnSymbols = columnElements
      .map((e) => extractReferee(compiler, filepath, e))
      .filter((s) => s !== undefined);

    columns = columnElements
      .map((element, index) => {
        const symbol = columnSymbols[index];
        if (!symbol || !(symbol instanceof ColumnSymbol || symbol instanceof TablePartialInjectedColumnSymbol)) {
          return null;
        }
        const columnName = extractVariableFromExpression(element).unwrap_or(undefined);
        if (columnName === undefined) return null;
        return extractNameAndTypeOfColumnSymbol(symbol, columnName);
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
