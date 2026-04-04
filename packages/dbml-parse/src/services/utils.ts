import type Compiler from '@/compiler/index';
import type { SyntaxNode } from '@/core/parser/nodes';
import { NodeSymbol, SchemaSymbol } from '@/core/types/symbols';
import { InfixExpressionNode } from '@/core/parser/nodes';
import type { TextModel, Position } from '@/services/types';
import { UNHANDLED } from '@/constants';

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
