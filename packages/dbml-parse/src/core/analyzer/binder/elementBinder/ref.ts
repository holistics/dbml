import { partition } from 'lodash-es';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '../../../parser/nodes';
import { ElementBinder, ElementBinderArgs, ElementBinderResult } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { getElementKind } from '../../utils';
import { ElementKind } from '../../types';
import { SymbolKind } from '../../symbol/symbolIndex';
import SymbolFactory from '../../symbol/factory';
import { BinderContext } from '@/core/analyzer/analyzer';

export default class RefBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor ({ declarationNode, context }: ElementBinderArgs, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
  }

  bind (): ElementBinderResult {
    if (!(this.declarationNode.parent instanceof ProgramNode) && getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Project) {
      return { errors: [] };
    }

    return { errors: this.bindBody(this.declarationNode.body) };
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([body]);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [...this.bindFields(fields as FunctionApplicationNode[]), ...this.bindSubElements(subs as ElementDeclarationNode[])];
  }

  private bindFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const args = [field.callee, ...field.args];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      return bindees.flatMap((bindee) => {
        let columnBindees = bindee.tupleElements.length ? bindee.tupleElements : bindee.variables.pop();
        const tableBindee = bindee.variables.pop();
        if (!columnBindees || !tableBindee) {
          return [];
        }
        if (!Array.isArray(columnBindees)) {
          columnBindees = [columnBindees];
        }

        const schemaBindees = bindee.variables;

        return columnBindees.flatMap((columnBindee) => lookupAndBindInScope(this.context.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
          { node: columnBindee, kind: SymbolKind.Column },
        ], this.context));
      });
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder({ declarationNode: sub as ElementDeclarationNode & { type: SyntaxToken }, context: this.context }, this.symbolFactory);

      return binder.bind().errors;
    });
  }
}
