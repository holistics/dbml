import _ from 'lodash';
import {
 BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { SymbolKind } from '../../symbol/symbolIndex';

export default class TableGroupBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private ast: ProgramNode;

 constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode) {
    this.declarationNode = declarationNode;
    this.ast = ast;
  }

  bind(): CompileError[] {
    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
  }

  private bindBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([body]);
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [...this.bindFields(fields as FunctionApplicationNode[]), ...this.bindSubElements(subs as ElementDeclarationNode[])];
  }

  private bindFields(fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const args = [field.callee, ...field.args];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      return bindees.flatMap((bindee) => {
        const tableBindee = bindee.variables.pop();
        if (!tableBindee) {
          return [];
        }
        const schemaBindees = bindee.variables;

        return lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
        ]);
      });
    });
  }

  private bindSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken }, this.ast);

      return binder.bind();
    });
  }
}
