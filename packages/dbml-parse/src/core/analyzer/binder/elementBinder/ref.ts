import { partition } from 'lodash';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { getElementKind } from '../../utils';
import { ElementKind } from '../../types';
import { SymbolKind } from '../../symbol/symbolIndex';
import SymbolFactory from '../../symbol/factory';

export default class RefBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.parent instanceof ProgramNode) && getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Project) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
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

        return columnBindees.flatMap((columnBindee) => lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
          { node: columnBindee, kind: SymbolKind.Column },
        ]));
      });
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);

      return binder.bind();
    });
  }
}
