import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  ProgramNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import { SymbolKind, type NodeSymbol } from '@/core/types/symbol';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import { scanNonListNodeForBinding } from '../utils';

export default class DepBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.parent instanceof ProgramNode) && !this.declarationNode.parent?.isKind(ElementKind.Project)) {
      return [];
    }
    return this.bindBody(this.declarationNode.body);
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([
        body,
      ]);
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.bindFields(fields as FunctionApplicationNode[]),
      ...this.bindSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private bindFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) return [];
      const args = [
        field.callee,
        ...field.args,
      ];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      const bindErrors = bindees.flatMap((bindee) => {
        const nodes = [
          ...bindee.variables,
          ...bindee.tupleElements,
        ];
        return nodes.flatMap((b) => this.compiler.nodeReferee(b).getErrors());
      });

      const levelErrors = this.checkEdgeLevelConsistency(field.callee);

      return bindErrors.concat(levelErrors);
    });
  }

  private checkEdgeLevelConsistency (callee: SyntaxNode): CompileError[] {
    if (!(callee instanceof InfixExpressionNode)) return [];

    const leftLevel = this.endpointLevel(callee.leftExpression);
    const rightLevel = this.endpointLevel(callee.rightExpression);

    if (leftLevel && rightLevel && leftLevel !== rightLevel) {
      return [
        new CompileError(
          CompileErrorCode.DEP_MIXED_LEVEL,
          'Both sides of a Dep edge must be at the same level (both table-level or both column-level)',
          callee,
        ),
      ];
    }

    // Column-level self-ref is not allowed
    if (leftLevel === 'column' && rightLevel === 'column') {
      const leftSymbol = this.endpointSymbol(callee.leftExpression);
      const rightSymbol = this.endpointSymbol(callee.rightExpression);
      if (leftSymbol && rightSymbol && leftSymbol === rightSymbol) {
        return [
          new CompileError(
            CompileErrorCode.DEP_SELF_LOOP,
            'A column cannot depend on itself',
            callee,
          ),
        ];
      }
    }

    return [];
  }

  private endpointSymbol (expr: SyntaxNode | undefined): NodeSymbol | undefined {
    if (!expr) return undefined;
    const fragments = destructureComplexVariableTuple(expr);
    if (!fragments) return undefined;
    const lastVar = fragments.variables.at(-1);
    if (!lastVar) return undefined;
    return this.compiler.nodeReferee(lastVar).getFiltered(UNHANDLED);
  }

  private endpointLevel (expr: SyntaxNode | undefined): 'table' | 'column' | undefined {
    if (!expr) return undefined;
    const fragments = destructureComplexVariableTuple(expr);
    if (!fragments) return undefined;

    if (fragments.tupleElements.length > 0) return 'column';

    const lastVar = fragments.variables.at(-1);
    if (!lastVar) return undefined;

    const symbol = this.compiler.nodeReferee(lastVar).getFiltered(UNHANDLED);
    if (symbol?.isKind(SymbolKind.Column)) return 'column';
    if (symbol?.isKind(SymbolKind.Table)) return 'table';

    return undefined;
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) return [];
      return this.compiler.bindNode(sub).getErrors();
    });
  }
}
