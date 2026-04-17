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

  const aliasesReport = this.symbolAliases(symbol);
  const usesReport = this.symbolUses(symbol);
  errors.push(...aliasesReport.getErrors(), ...usesReport.getErrors());
  warnings.push(...aliasesReport.getWarnings(), ...usesReport.getWarnings());

  const targets = new Set<NodeSymbol>([
    symbol,
    ...aliasesReport.getValue(),
    ...usesReport.getValue(),
  ]);

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
        if (ref && targets.has(ref)) pushRef(node);
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
            if (ref && targets.has(ref)) pushRef(tableNode);
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
