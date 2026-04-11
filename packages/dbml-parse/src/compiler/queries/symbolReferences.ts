import type Compiler from '../index';
import { SyntaxNode, PrimaryExpressionNode, TupleExpressionNode, InfixExpressionNode } from '@/core/types/nodes';
import { NodeSymbol, SymbolKind } from '@/core/types/symbol';
import { UNHANDLED } from '@/constants';
import { isExpressionAVariableNode, isAccessExpression } from '@/core/utils/expression';
import { getMemberChain } from '@/core/parser/utils';
import Report from '@/core/types/report';
import { nodeReferee } from '@/core/global_modules';

// Get the right-most variable node in a member access chain (e.g., for schema.table, returns the table node)
function getRightmostVariable (node: SyntaxNode): SyntaxNode | undefined {
  if (isExpressionAVariableNode(node)) return node;
  if (isAccessExpression(node)) {
    const right = (node as InfixExpressionNode).rightExpression;
    if (right && isExpressionAVariableNode(right)) return right;
  }
  return undefined;
}

// Collect all AST nodes whose nodeReferee resolves to the given symbol.
// Walks every variable node checking the memoized nodeReferee result.
export function symbolReferences (this: Compiler, symbol: NodeSymbol): Report<SyntaxNode[]> {
  const asts = this.parseProject().values();
  this.bindProject();

  const refs: SyntaxNode[] = [];

  for (const astReport of asts) {
    const ast = astReport.getValue().ast;
    const walk = (node: SyntaxNode): void => {
      if (isExpressionAVariableNode(node)) {
        const refereeResult = nodeReferee.call(this, node);
        if (refereeResult.hasValue(UNHANDLED)) return;
        if (refereeResult.getValue() === symbol) {
          refs.push(node);
        }
        return;
      }
      // Handle tuple access: table.(col1, col2) - tuple counts as a reference to the table
      if (node instanceof TupleExpressionNode
        && isAccessExpression(node.parentNode)
        && (node.parentNode as InfixExpressionNode).rightExpression === node) {
        const leftExpr = (node.parentNode as InfixExpressionNode).leftExpression;
        if (leftExpr) {
          const tableNode = getRightmostVariable(leftExpr);
          if (tableNode) {
            const tableResult = nodeReferee.call(this, tableNode);
            if (!tableResult.hasValue(UNHANDLED) && tableResult.getValue() === symbol) {
            // Push the table variable node, not the tuple, so sourceText shows the table name
              refs.push(tableNode);
            }
          }
        }
      }
      for (const child of getMemberChain(node)) {
        if (child instanceof SyntaxNode) walk(child);
      }
    };
    walk(ast);
  }

  return new Report(refs);
}
