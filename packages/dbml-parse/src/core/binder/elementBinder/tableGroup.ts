import { partition } from 'lodash-es';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '@/core/parser/nodes';
import { ElementBinder, ElementBinderArgs, ElementBinderResult } from '../types';
import { SyntaxToken } from '@/core/lexer/tokens';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { SymbolKind } from '@/core/validator/symbol/symbolIndex';
import SymbolFactory from '@/core/validator/symbol/factory';
import { BinderContext } from '@/core/types';

export default class TableGroupBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor ({ declarationNode, context }: ElementBinderArgs, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
  }

  bind (): ElementBinderResult {
    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
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
        const tableBindee = bindee.variables.pop();
        if (!tableBindee) {
          return [];
        }
        const schemaBindees = bindee.variables;

        const errors = lookupAndBindInScope(this.context.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
        ], this.context);
        if (errors.length > 0) return errors;

        // A tablegroup can only contain tables defined in the current file
        const boundSymbol = this.context.nodeToReferee.get(tableBindee);
        if (boundSymbol?.isExternal(this.context.filepath)) {
          return [new CompileError(CompileErrorCode.BINDING_ERROR, 'A TableGroup can only contain locally defined tables', tableBindee, this.symbolFactory.filepath)];
        }

        return [];
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
