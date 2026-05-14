import type Compiler from '@/compiler';
import { getMemberChain } from '@/core/parser/utils';
import type { RelationCardinality } from '@/core/types';
import { UNHANDLED } from '@/core/types/module';
import {
  InfixExpressionNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, SyntaxNode, TupleExpressionNode, VariableNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { NodeSymbol } from '@/core/types/symbol';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import { isAccessExpression, isExpressionAVariableNode } from '../utils/validate';

export function shouldInterpretNode (compiler: Compiler, node: SyntaxNode): boolean {
  return compiler.reachableFiles(node.filepath).every(
    (file) => compiler.bindFile(file).getErrors().length === 0,
  );
}

// Get all symbols syntactically defined inside `node`
export function getNodeMemberSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> {
  const children = getMemberChain(node).filter((node) => node instanceof SyntaxNode);
  if (!children) {
    return new Report([]);
  }

  return children.reduce(
    (report, child) => {
      const symbol = compiler.nodeSymbol(child);
      const nestedSymbols = getNodeMemberSymbols(compiler, child);
      return new Report(
        [
          ...report.getValue(),
          ...(nestedSymbols.hasValue(UNHANDLED) ? [] : nestedSymbols.getValue()),
        ],
        [
          ...report.getErrors(),
          ...(symbol.hasValue(UNHANDLED) ? [] : symbol.getErrors()),
          ...(nestedSymbols.hasValue(UNHANDLED) ? [] : nestedSymbols.getErrors()),
        ],
        [
          ...report.getWarnings(),
          ...(symbol.hasValue(UNHANDLED) ? [] : symbol.getWarnings()),
          ...(nestedSymbols.hasValue(UNHANDLED) ? [] : nestedSymbols.getWarnings()),
        ],
      );
    },
    new Report<NodeSymbol[]>([]),
  );
}

// Scan for variable node and member access expression in the node except ListExpressionNo
export function scanNonListNodeForBinding (node?: SyntaxNode): { variables: (PrimaryExpressionNode & { expression: VariableNode })[];
  tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[]; }[] {
  if (!node) return [];

  if (isExpressionAVariableNode(node)) {
    return [
      {
        variables: [
          node,
        ],
        tupleElements: [],
      },
    ];
  }

  if (node instanceof InfixExpressionNode) {
    const fragments = destructureComplexVariableTuple(node);
    if (!fragments) {
      return [
        ...scanNonListNodeForBinding(node.leftExpression),
        ...scanNonListNodeForBinding(node.rightExpression),
      ];
    }
    return [
      fragments,
    ];
  }

  if (node instanceof PrefixExpressionNode) {
    return scanNonListNodeForBinding(node.expression);
  }

  if (node instanceof PostfixExpressionNode) {
    return scanNonListNodeForBinding(node.expression);
  }

  if (node instanceof TupleExpressionNode) {
    const fragments = destructureComplexVariableTuple(node);
    if (!fragments) {
      return node.elementList.flatMap(scanNonListNodeForBinding);
    }
    return [
      fragments,
    ];
  }

  return [];
}

// For a node that is the right side of an access expression (a.b),
// resolve the left side via compiler.nodeReferee and return its symbol.
export function nodeRefereeOfLeftExpression (compiler: Compiler, node: SyntaxNode): NodeSymbol | undefined {
  const parent = node.parentNode;
  if (!parent || !isAccessExpression(parent) || parent.rightExpression !== node) return undefined;
  let leftExpr = parent.leftExpression;
  // If the left is also an access expression (a.b.c), resolve the rightmost leaf
  while (isAccessExpression(leftExpr)) {
    leftExpr = leftExpr.rightExpression;
  }
  return compiler.nodeReferee(leftExpr).getFiltered(UNHANDLED) ?? undefined;
}

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] | undefined {
  switch (op) {
    case '<':
      return [
        '1',
        '*',
      ];
    case '<>':
      return [
        '*',
        '*',
      ];
    case '>':
      return [
        '*',
        '1',
      ];
    case '-':
      return [
        '1',
        '1',
      ];
    default:
      return undefined;
  }
}
