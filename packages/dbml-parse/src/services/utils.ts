import type Compiler from '@/compiler/index';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { InfixExpressionNode } from '@/core/parser/nodes';
import type { TextModel, Position } from '@/services/types';

export function getOffsetFromMonacoPosition (model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}

// Extract referee from a simple variable (x) or complex variable (a.b.c)
// For complex variables, returns the referee of the rightmost part
export function extractReferee (compiler: Compiler, node: SyntaxNode | undefined): NodeSymbol | undefined {
  if (!node) return undefined;

  if (node instanceof InfixExpressionNode && node.op?.value === '.') {
    return extractReferee(compiler, node.rightExpression);
  }

  return compiler.nodeReferee(node);
}
