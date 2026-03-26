import { last, partition } from 'lodash-es';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementBinder } from '../types';
import { CompileError } from '@/core/errors';
import { aggregateSettingList } from '@/core/analyzer/validator/utils';
import { destructureComplexVariableTuple } from '@/core/utils';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { BinderContext } from '@/core/analyzer/analyzer';

export default class TablePartialBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor (
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
    context: BinderContext,
    symbolFactory: SymbolFactory,
  ) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
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

      const errors: CompileError[] = [];

      const args = [field.callee, ...field.args];
      if (last(args) instanceof ListExpressionNode) {
        const listExpression = last(args) as ListExpressionNode;
        const settingsMap = aggregateSettingList(listExpression).getValue();

        errors.push(...(settingsMap.ref?.flatMap((ref) => (ref.value ? this.bindInlineRef(ref.value) : [])) || []));
        args.pop();
      }

      if (!args[1]) {
        return errors;
      }
      this.tryToBindColumnType(args[1]);

      return errors;
    });
  }

  private tryToBindColumnType (typeNode: SyntaxNode) {
    const fragments = destructureComplexVariableTuple(typeNode).unwrap_or(undefined);
    if (!fragments) {
      return;
    }

    const enumBindee = fragments.variables.pop();
    const schemaBindees = fragments.variables;

    if (!enumBindee) {
      return;
    }

    lookupAndBindInScope(this.context.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: enumBindee, kind: SymbolKind.Enum },
    ], this.context);
  }

  private bindInlineRef (ref: SyntaxNode): CompileError[] {
    const bindees = scanNonListNodeForBinding(ref);

    return bindees.flatMap((bindee) => {
      const columnBindee = bindee.variables.pop();
      const tableBindee = bindee.variables.pop();
      if (!columnBindee) {
        return [];
      }
      const schemaBindees = bindee.variables;

      return tableBindee
        ? lookupAndBindInScope(this.context.ast, [
            ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
            { node: tableBindee, kind: SymbolKind.Table },
            { node: columnBindee, kind: SymbolKind.Column },
          ], this.context)
        : lookupAndBindInScope(this.declarationNode, [
            { node: columnBindee, kind: SymbolKind.Column },
          ], this.context);
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(
        sub as ElementDeclarationNode & { type: SyntaxToken },
        this.context,
        this.symbolFactory,
      );

      return binder.bind();
    });
  }
}
