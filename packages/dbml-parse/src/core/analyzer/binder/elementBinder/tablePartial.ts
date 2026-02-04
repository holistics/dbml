import { last, partition } from 'lodash';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementBinder } from '../types';
import { CompileError } from '../../../errors';
import { aggregateSettingList } from '../../validator/utils';
import { destructureComplexVariableTuple } from '../../utils';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { SymbolKind } from '../../symbol/symbolIndex';
import SymbolFactory from '../../symbol/factory';
import { isExpressionAQuotedString, isExpressionAVariableNode } from '@/core/parser/utils';
import { KEYWORDS_OF_DEFAULT_SETTING } from '@/constants';

export default class TablePartialBinder implements ElementBinder {
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
        errors.push(...(settingsMap.default?.flatMap((def) => (def.value ? this.tryToBindEnumFieldRef(def.value) : [])) || []));
        errors.push(...(settingsMap.check?.flatMap((chk) => (chk.value ? this.tryToBindEnumRef(chk.value) : [])) || []));
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

    lookupAndBindInScope(this.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: enumBindee, kind: SymbolKind.Enum },
    ]);
  }

  // Bind enum field references in default values (e.g., order_status.pending)
  private tryToBindEnumFieldRef (defaultValue: SyntaxNode): CompileError[] {
    // Skip quoted strings (e.g., [default: "hello"] or [default: `hello`])
    if (isExpressionAQuotedString(defaultValue)) {
      return [];
    }

    // Skip keywords (null, true, false)
    if (isExpressionAVariableNode(defaultValue)) {
      const varName = defaultValue.expression.variable?.value?.toLowerCase();
      if (varName && KEYWORDS_OF_DEFAULT_SETTING.includes(varName)) {
        return [];
      }
    }

    const fragments = destructureComplexVariableTuple(defaultValue).unwrap_or(undefined);
    if (!fragments) {
      return [];
    }

    const enumFieldBindee = fragments.variables.pop();
    const enumBindee = fragments.variables.pop();

    if (!enumFieldBindee || !enumBindee) {
      return [];
    }

    const schemaBindees = fragments.variables;

    return lookupAndBindInScope(this.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: enumBindee, kind: SymbolKind.Enum },
      { node: enumFieldBindee, kind: SymbolKind.EnumField },
    ]);
  }

  // Bind enum references in inline checks (e.g., schema.enum)
  private tryToBindEnumRef (checkValue: SyntaxNode): CompileError[] {
    const fragments = destructureComplexVariableTuple(checkValue).unwrap_or(undefined);
    if (!fragments) {
      return [];
    }

    const enumBindee = fragments.variables.pop();

    if (!enumBindee) {
      return [];
    }

    const schemaBindees = fragments.variables;

    return lookupAndBindInScope(this.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: enumBindee, kind: SymbolKind.Enum },
    ]);
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
        ? lookupAndBindInScope(this.ast, [
            ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
            { node: tableBindee, kind: SymbolKind.Table },
            { node: columnBindee, kind: SymbolKind.Column },
          ])
        : lookupAndBindInScope(this.declarationNode, [
            { node: columnBindee, kind: SymbolKind.Column },
          ]);
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
