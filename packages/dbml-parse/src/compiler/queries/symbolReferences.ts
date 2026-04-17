import {
  nodeReferee,
} from '@/core/global_modules';
import {
  getMemberChain,
} from '@/core/parser/utils';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  InfixExpressionNode, SyntaxNode, TupleExpressionNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  NodeSymbol,
} from '@/core/types/symbol';
import {
  isAccessExpression, isExpressionAVariableNode,
} from '@/core/utils/expression';
import type Compiler from '../index';

// Get the right-most variable node in a member access chain (e.g., for schema.table, returns the table node)
function getRightmostVariable (node: SyntaxNode): SyntaxNode | undefined {
  if (isExpressionAVariableNode(node)) return node;
  if (isAccessExpression(node)) {
    const right = (node as InfixExpressionNode).rightExpression;
    if (right && isExpressionAVariableNode(right)) return right;
  }
  return undefined;
}

// Collect all AST nodes whose nodeReferee resolves to any of the given symbols.
// Walks every variable node checking the memoized nodeReferee result.
export function symbolReferences (this: Compiler, symbol: NodeSymbol): Report<SyntaxNode[]> {
  const astMap = this.parseProject();
  this.bindProject();

  const errors = [];
  const warnings = [];

  // When the target is the original declaration, include references that flow
  // through any alias or use (they unwrap to the same originalSymbol). When
  // the target is itself an alias/use, stay narrow — only direct identity
  // matches — so callers like renameAlias see just the alias-side refs, not
  // the source-side ones that bypass the alias entirely.
  const isOriginal = symbol.originalSymbol === symbol;
  const matches = (ref: NodeSymbol | undefined): boolean => {
    if (!ref) return false;
    if (ref === symbol) return true;
    return isOriginal && ref.originalSymbol === symbol;
  };

  const refs: SyntaxNode[] = [];
  const seen = new Set<SyntaxNode>();
  const pushRef = (n: SyntaxNode) => {
    if (!seen.has(n)) {
      seen.add(n);
      refs.push(n);
    }
  };

  for (const astReport of astMap.values()) {
    errors.push(...astReport.getErrors());
    warnings.push(...astReport.getWarnings());
    const ast = astReport.getValue().ast;
    const walk = (node: SyntaxNode): void => {
      if (isExpressionAVariableNode(node)) {
        const ref = nodeReferee.call(this, node).getFiltered(UNHANDLED);
        if (matches(ref)) pushRef(node);
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
            const ref = nodeReferee.call(this, tableNode).getFiltered(UNHANDLED);
            if (matches(ref)) pushRef(tableNode);
          }
        }
      }
      for (const child of getMemberChain(node)) {
        if (child instanceof SyntaxNode) walk(child);
      }
    };
    walk(ast);
  }

  return new Report(refs, errors, warnings);
}
