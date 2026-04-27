import {
  partition,
} from 'lodash-es';
import {
  CompileError,
} from '@/core/types/errors';
import SymbolFactory from '@/core/types/symbol/factory';
import {
  SymbolKind,
} from '@/core/types/symbol/symbolIndex';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  pickBinder,
} from '@/core/global_modules';
import {
  lookupAndBindInScope, scanNonListNodeForBinding,
} from '@/core/global_modules/utils';

export default class TableGroupBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
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
      if (!field.callee) {
        return [];
      }

      const args = [
        field.callee,
        ...field.args,
      ];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      return bindees.flatMap((bindee) => {
        const tableBindee = bindee.variables.pop();
        if (!tableBindee) {
          return [];
        }
        const schemaBindees = bindee.variables;

        return lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({
            node: b,
            kind: SymbolKind.Schema,
          })),
          {
            node: tableBindee,
            kind: SymbolKind.Table,
          },
        ]);
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
