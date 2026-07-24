import type Compiler from '@/compiler';
import { getMemberChain } from '@/core/parser/utils';
import type { RelationCardinality } from '@/core/types';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { UNHANDLED } from '@/core/types/module';
import {
  InfixExpressionNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, SyntaxNode, TupleExpressionNode, VariableNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import { SymbolKind } from '@/core/types/symbol';
import type { NodeSymbol } from '@/core/types/symbol';
import { extractVarNameFromPrimaryVariable } from '@/core/utils/expression';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import { isAccessExpression, isExpressionAVariableNode, isTerminalAccessFragment } from '../utils/validate';

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

// Scan for variable node and member access expression in the node except ListExpressionNode
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

// Generic resolution for access expressions like schema.table.column or schema.table
export function nodeRefereeOfEndpoint (
  compiler: Compiler,
  globalSymbol: NodeSymbol,
  node: SyntaxNode,
  terminalKind: SymbolKind.Column | SymbolKind.Table, // `terminalKind` determines what the rightmost fragment resolves as
): Report<NodeSymbol | undefined> {
  if (!isExpressionAVariableNode(node)) return new Report(undefined);
  const name = extractVarNameFromPrimaryVariable(node) ?? '';

  // Rightmost side of access expression - resolve as terminal kind
  if (
    isAccessExpression(node.parentNode)
    && node.parentNode.rightExpression === node
    && isTerminalAccessFragment(node)
  ) {
    const left = nodeRefereeOfLeftExpression(compiler, node);
    if (!left) return new Report(undefined);

    if (terminalKind === SymbolKind.Column) {
      if (left.isKind(SymbolKind.Table)) {
        const symbol = compiler.lookupMembers(left, SymbolKind.Column, name);
        if (symbol) {
          return Report.create(symbol);
        }

        return new Report(undefined, [
          new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table 'public.${left.name}'`, node),
        ]);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist`, node),
      ]);
    } else {
      if (left.isKind(SymbolKind.Schema)) {
        const symbol = compiler.lookupMembers(left, SymbolKind.Table, name);
        if (symbol) {
          return Report.create(symbol);
        }

        return new Report(undefined, [
          new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
        ]);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist`, node),
      ]);
    }
  }

  // Non-terminal right side of access expression - resolve via left sibling as table or schema
  const left = nodeRefereeOfLeftExpression(compiler, node);
  if (left) {
    if (left.isKind(SymbolKind.Schema)) {
      const symbol = compiler.lookupMembers(left, [
        SymbolKind.Table,
        SymbolKind.Schema,
      ], name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Table or schema '${name}' does not exist`, node),
      ]);
    }
    if (terminalKind === SymbolKind.Column && left.isKind(SymbolKind.Table)) {
      const symbol = compiler.lookupMembers(left, SymbolKind.Column, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${name}' does not exist in Table 'public.${left.name}'`, node),
      ]);
    }

    return new Report(undefined);
  }

  // Leftmost side of access expression - look up as Table or Schema in program scope
  const parent = node.parentNode as InfixExpressionNode;
  if (parent.leftExpression === node) {
    // If parent is also left of another access, or this is a table-level endpoint, resolve as schema
    if (
      (isAccessExpression(parent.parentNode) && (parent.parentNode as InfixExpressionNode).leftExpression === parent)
      || terminalKind === SymbolKind.Table
    ) {
      const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Schema, name);
      if (symbol) {
        return Report.create(symbol);
      }

      return new Report(undefined, [
        new CompileError(CompileErrorCode.BINDING_ERROR, `Schema '${name}' does not exist in Schema 'public'`, node),
      ]);
    }

    // Otherwise resolve as table
    const symbol = compiler.lookupMembers(globalSymbol, SymbolKind.Table, name);
    if (symbol) {
      return Report.create(symbol);
    }

    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Table '${name}' does not exist in Schema 'public'`, node),
    ]);
  }

  return new Report(undefined);
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
