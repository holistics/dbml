import type Compiler from '@/compiler/index';
import {
  UNHANDLED,
} from '@/core/types/module';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  InfixExpressionNode,
} from '@/core/types/nodes';
import type {
  NodeSymbol,
} from '@/core/types/symbol';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import type {
  Position, Range, TextModel,
} from '@/services/types';

export function getOffsetFromMonacoPosition (model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}

// Extract referee from a simple variable (x) or complex variable (a.b.c)
export function extractReferee (compiler: Compiler, node: SyntaxNode | undefined): NodeSymbol | undefined {
  if (!node) return undefined;
  if (node instanceof InfixExpressionNode && node.op?.value === '.') {
    return extractReferee(compiler, node.rightExpression);
  }
  const result = compiler.nodeReferee(node);
  if (result.hasValue(UNHANDLED)) return undefined;
  return result.getValue() ?? undefined;
}

export function getEditorRange (model: TextModel, nodeOrToken: SyntaxNode | SyntaxToken): Range {
  const {
    startPos,
    endPos,
  } = nodeOrToken;

  return {
    startLineNumber: startPos.line + 1,
    startColumn: startPos.column + 1,
    endLineNumber: endPos.line + 1,
    endColumn: endPos.column + 1,
  };
}
