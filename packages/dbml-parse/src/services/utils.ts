import type { TextModel, Position } from '@/services/types';
import { Filepath } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import type Compiler from '@/compiler';
import type { SyntaxNode } from '@/core/parser/nodes';
import { InfixExpressionNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';

export function getOffsetFromMonacoPosition (model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}

export function getFilepathFromModel (model: TextModel): Filepath {
  try {
    return Filepath.from(model.uri.path);
  } catch {
    return DEFAULT_ENTRY;
  }
}

// Extract referee from a simple variable (x) or complex variable (a.b.c)
// For complex variables, returns the referee of the rightmost part
export function extractReferee (compiler: Compiler, node: SyntaxNode | undefined): NodeSymbol | undefined {
  if (!node) return undefined;

  // Complex variable: a.b.c - get referee from rightmost part
  if (node instanceof InfixExpressionNode && node.op?.value === '.') {
    return extractReferee(compiler, node.rightExpression);
  }

  return compiler.nodeReferee(node);
}
