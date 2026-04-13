import {
  extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  extractReferee,
} from '@/services/utils';
import {
  SymbolKind,
} from '@/core/types/symbol';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ProgramNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  type CompletionList,
  type TextModel,
  type Position,
  CompletionItemKind,
  CompletionItemInsertTextRule,
} from '@/services/types';
import {
  ElementKind,
} from '@/core/types/keywords';
import Compiler from '@/compiler';
import {
  noSuggestions,
  getColumnsFromTableSymbol,
  extractNameAndTypeOfColumnSymbol,
} from '@/services/suggestions/utils';
import {
  isOffsetWithinSpan,
} from '@/core/utils/span';
import {
  UNHANDLED,
} from '@/constants';

export function suggestRecordRowSnippet (
  compiler: Compiler,
  model: TextModel,
  position: Position,
  offset: number,
): CompletionList | null {
  const element = compiler.container.element(offset);

  // If not in an ElementDeclarationNode, fallthrough
  if (!(element instanceof ElementDeclarationNode)) return null;

  // If not in a Records element, fallthrough
  if (!element.isKind(ElementKind.Records) || !(element.body instanceof BlockExpressionNode)) return null;

  // If we're not within the body, fallthrough
  if (!element.body || !isOffsetWithinSpan(offset, element.body)) return null;

  const lineContent = model.getLineContent(position.lineNumber);
  // Not on an empty line - fallthrough to allow other completions in Records body
  if (lineContent.trim() !== '') return null;

  // On an empty line in Records body - provide record row snippet
  if (element.parent instanceof ProgramNode) {
    return suggestRecordRowInTopLevelRecords(compiler, element);
  } else {
    return suggestRecordRowInNestedRecords(compiler, element);
  }
}

function suggestRecordRowInTopLevelRecords (
  compiler: Compiler,
  recordsElement: ElementDeclarationNode,
): CompletionList {
  // Top-level Records only work with explicit column list: Records users(id, name) { }
  if (!(recordsElement.name instanceof CallExpressionNode)) return noSuggestions();

  const columnElements = recordsElement.name.argumentList?.elementList || [];
  const columnSymbols = columnElements.map((e) => extractReferee(compiler, e));
  if (!columnSymbols || columnSymbols.length === 0) return noSuggestions();

  const columns = columnElements
    .map((element, index) => {
      const symbol = columnSymbols[index];
      if (!symbol || !(symbol.isKind(SymbolKind.Column) || symbol.isKind(SymbolKind.Column))) {
        return null;
      }
      const columnName = extractVariableFromExpression(element);
      if (!columnName) return null;
      const result = extractNameAndTypeOfColumnSymbol(symbol, columnName);
      return result;
    })
    .filter((col) => col !== null) as Array<{ name: string;
    type: string; }>;

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

  const tableSymbol = compiler.nodeSymbol(parent).getFiltered(UNHANDLED);
  if (!tableSymbol || !(tableSymbol.isKind(SymbolKind.Table))) {
    return noSuggestions();
  }

  let columns: Array<{ name: string;
    type: string; }>;

  if (recordsElement.name instanceof TupleExpressionNode) {
    // Explicit columns from tuple: records (col1, col2)
    const columnElements = recordsElement.name.elementList;
    const columnSymbols = columnElements
      .map((e) => extractReferee(compiler, e))
      .filter((s) => s !== undefined);

    columns = columnElements
      .map((element, index) => {
        const symbol = columnSymbols[index];
        if (!symbol || !(symbol.isKind(SymbolKind.Column) || symbol.isKind(SymbolKind.Column))) {
          return null;
        }
        const columnName = extractVariableFromExpression(element);
        if (columnName === undefined) return null;
        return extractNameAndTypeOfColumnSymbol(symbol, columnName);
      })
      .filter((col) => col !== null) as Array<{ name: string;
      type: string; }>;
  } else {
    // Implicit columns - use all columns from parent table
    const result = getColumnsFromTableSymbol(compiler, tableSymbol);
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
