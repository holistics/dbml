import _ from 'lodash';
import {
 BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { aggregateSettingList } from '../../validator/utils';
import { SymbolKind } from '../../symbol/symbolIndex';
import { destructureComplexVariableTuple } from '../../../analyzer/utils';

export default class TableBinder implements ElementBinder {
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

      const errors: CompileError[] = [];

      const args = [field.callee, ...field.args];

      if (_.last(args) instanceof ListExpressionNode) {
        const listExpression = _.last(args) as ListExpressionNode;
        const settingsMap = aggregateSettingList(listExpression).getValue();

        errors.push(...(settingsMap['ref']?.flatMap((ref) => (ref.value ? this.bindInlineRef(ref.value) : [])) || []));
        args.pop();
      }

      if (!args[1]) {
        return errors;
      }
      this.tryToBindColumnType(args[1]);

      return errors;
    });
  }

  private tryToBindColumnType(typeNode: SyntaxNode) {
    const fragments = destructureComplexVariableTuple(typeNode).unwrap_or(undefined);
    if (!fragments) {
      return;
    }

    const enumBindee = fragments.variables.pop();
    const schemaBindees = fragments.variables;

    if (!enumBindee) {
      return;
    }

    lookupAndBindInScope(this.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: enumBindee, kind: SymbolKind.Enum },
    ]);
  }

  private bindInlineRef(ref: SyntaxNode): CompileError[] {
    const bindees = scanNonListNodeForBinding(ref);

    return bindees.flatMap((bindee) => {
      const columnBindee = bindee.variables.pop();
      const tableBindee = bindee.variables.pop();
      if (!columnBindee) {
        return [];
      }
      const schemaBindees = bindee.variables;

      return tableBindee ?
        lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
          { node: columnBindee, kind: SymbolKind.Column },
        ]) :
        lookupAndBindInScope(this.declarationNode, [
          { node: columnBindee, kind: SymbolKind.Column },
        ]);
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
