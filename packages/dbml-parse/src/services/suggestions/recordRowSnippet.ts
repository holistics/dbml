import Compiler from '@/compiler';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ProgramNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  isOffsetWithinSpan,
} from '@/core/utils/span';
import {
  noSuggestions,
} from '@/services/suggestions/utils';
import {
  CompletionItemInsertTextRule,
  CompletionItemKind,
  type CompletionList,
  type Position,
  type TextModel,
} from '@/services/types';
import {
  ColumnSymbol,
  InjectedColumnSymbol,
  SymbolKind,
  TableSymbol,
} from '@/core/types/symbol';

export function suggestRecordRowSnippet (
  compiler: Compiler,
  model: TextModel,
  position: Position,
  filepath: Filepath,
  offset: number,
): CompletionList | null {
  const element = compiler.container.element(filepath, offset);

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
  const columnSymbols = columnElements.map((e) => compiler.nodeReferee(e).getFiltered(UNHANDLED));
  if (!columnSymbols || columnSymbols.length === 0) return noSuggestions();

  const columns = columnElements
    .flatMap((element, index) => {
      const symbol = columnSymbols[index];
      if (!(symbol instanceof ColumnSymbol || symbol instanceof InjectedColumnSymbol)) {
        return [];
      }
      const {
        name,
      } = symbol.canonicalName(compiler, element.filepath)!;
      const {
        name: type,
      } = symbol.type(compiler)!;
      return {
        name,
        type,
      };
    });

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
  if (!(tableSymbol instanceof TableSymbol)) {
    return noSuggestions();
  }

  let columns: Array<{
    name: string;
    type: string;
  }>;

  if (recordsElement.name instanceof TupleExpressionNode) {
    // Explicit columns from tuple: records (col1, col2)
    const columnElements = recordsElement.name.elementList;
    const columnSymbols = columnElements
      .map((e) => compiler.nodeReferee(e).getFiltered(UNHANDLED))
      .filter((s) => s !== undefined);

    columns = columnElements
      .flatMap((element, index) => {
        const symbol = columnSymbols[index];
        if (!(symbol instanceof ColumnSymbol || symbol instanceof InjectedColumnSymbol)) {
          return [];
        }
        const {
          name,
        } = symbol.canonicalName(compiler, element.filepath)!;
        const {
          name: type,
        } = symbol.type(compiler)!;
        return {
          name,
          type,
        };
      });
  } else {
    // Implicit columns: use all columns from parent table
    const result = tableSymbol.mergedColumns(compiler).flatMap((symbol) => {
      const {
        name,
      } = symbol.canonicalName(compiler, symbol.filepath)!;
      const {
        name: type,
      } = symbol.type(compiler)!;
      return {
        name,
        type,
      };
    });
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
