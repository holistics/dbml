import Compiler, { ScopeKind } from '@/compiler';
import { SyntaxTokenKind } from '@/core/lexer/tokens';
import {
  type InlineCompletionItemProvider,
  type TextModel,
  type Position,
  type InlineCompletions,
} from '@/services/types';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import { ElementDeclarationNode, FunctionApplicationNode, CallExpressionNode } from '@/core/parser/nodes';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { TableSymbol } from '@/core/analyzer/symbol/symbols';
import { getColumnsFromTableSymbol } from '@/services/suggestions/utils';

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
    if (elementKind !== ElementKind.Records) {
      return null;
    }

    if (!element.body) {
      return null;
    }

    // Check if we're outside any function application
    // This means we're ready to type a new record entry
    const containers = [...this.compiler.container.stack(offset)];
    const isInFunctionApplication = containers.some(
      (container) => container instanceof FunctionApplicationNode,
    );
    if (isInFunctionApplication) {
      return null;
    }

    // Check if cursor is at the start of a line (only whitespace before it)
    const lineContent = model.getLineContent(position.lineNumber);
    const textBeforeCursor = lineContent.substring(0, position.column - 1);
    if (textBeforeCursor.trim() !== '') {
      return null;
    }

    // Check if the previous character is a newline or we're at the start of a line
    const { token } = this.compiler.container.token(offset);
    if (!token) {
      return null;
    }

    // Check if we should trigger: after newline in the body
    const shouldTrigger = token.kind === SyntaxTokenKind.NEWLINE
      || token.kind === SyntaxTokenKind.LBRACE
      || (token.trailingTrivia && token.trailingTrivia.some(
        (t) => t.kind === SyntaxTokenKind.NEWLINE && t.end <= offset,
      ));

    if (!shouldTrigger) {
      return null;
    }

    // Get the table symbol
    let tableSymbol;

    // For nested Records (inside Table), parent.symbol is the TableSymbol
    if (element.parent?.symbol instanceof TableSymbol) {
      tableSymbol = element.parent.symbol;
    }
    // For top-level Records like: Records Users(id, b) { }
    // element.name is a CallExpressionNode, and callee.referee is the table
    else if (element.name instanceof CallExpressionNode) {
      tableSymbol = element.name.callee?.referee;
    }
    // For simple top-level Records (though syntax doesn't allow this without columns)
    else if (element.name) {
      tableSymbol = element.name.referee;
    }

    if (!tableSymbol || !(tableSymbol instanceof TableSymbol)) {
      return null;
    }

    // Get all columns from the table
    const columns = getColumnsFromTableSymbol(tableSymbol, this.compiler);

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

  // Required by Monaco's InlineCompletionsProvider interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  freeInlineCompletions (completions: InlineCompletions): void {
    // No cleanup needed for our simple implementation
  }
}
