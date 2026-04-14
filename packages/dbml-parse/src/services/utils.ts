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
import {
  NodeSymbol, SchemaSymbol,
} from '@/core/types/symbol';
import type {
  Position, TextModel,
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
