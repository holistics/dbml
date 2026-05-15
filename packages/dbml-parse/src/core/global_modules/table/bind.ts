import { last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { KEYWORDS_OF_DEFAULT_SETTING } from '@/constants';
import { CompileError } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import { InfixExpressionNode } from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import {
  isAccessExpression,
  isExpressionAQuotedString, isExpressionAVariableNode,
  aggregateSettingList, isValidPartialInjection,
} from '@/core/utils/validate';
import { scanNonListNodeForBinding } from '../utils';

export default class TableBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
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
    const columns = fields.filter((f) => !isValidPartialInjection(f.callee));

    const bindColumns = (cs: FunctionApplicationNode[]): CompileError[] => {
      return cs.flatMap((c) => {
        if (!c.callee) {
          return [];
        }

        const errors: CompileError[] = [];

        const args = [
          c.callee,
          ...c.args,
        ];
        if (last(args) instanceof ListExpressionNode) {
          const listExpression = last(args) as ListExpressionNode;
          const settingsMap = aggregateSettingList(listExpression).getValue();

          errors.push(...(settingsMap.ref?.flatMap((ref) => (ref.value ? this.bindInlineRef(ref.value) : [])) || []));
          errors.push(...(settingsMap.default?.flatMap((def) => (def.value ? this.tryToBindEnumFieldRef(def.value) : [])) || []));
          args.pop();
        }

        if (!args[1]) {
          return errors;
        }
        this.tryToBindColumnType(args[1]);

        return errors;
      });
    };
    return bindColumns(columns);
  }

  private tryToBindColumnType (typeNode: SyntaxNode) {
    const fragments = destructureComplexVariableTuple(typeNode);
    if (!fragments) {
      return;
    }

    const enumBindee = fragments.variables.pop();

    if (!enumBindee) {
      return;
    }

    this.compiler.nodeReferee(enumBindee).getErrors();
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

    const fragments = destructureComplexVariableTuple(defaultValue);
    if (!fragments) {
      // Handle literal.field access (e.g., true.value, "hello".abc)
      // where the left side is not a variable
      if (isAccessExpression(defaultValue)) {
        const infixNode = defaultValue as InfixExpressionNode;
        const errors: CompileError[] = [];
        if (infixNode.leftExpression) {
          errors.push(...this.compiler.nodeReferee(infixNode.leftExpression).getErrors());
        }
        if (infixNode.rightExpression) {
          errors.push(...this.compiler.nodeReferee(infixNode.rightExpression).getErrors());
        }
        return errors;
      }
      return [];
    }

    const enumFieldBindee = fragments.variables.pop();
    const enumBindee = fragments.variables.pop();

    if (!enumFieldBindee || !enumBindee) {
      return [];
    }

    const errors: CompileError[] = [];
    const schemaBindees = fragments.variables;

    // Collect errors from schema components - errors are silently dropped by
    // nodeRefereeOfLeftExpression, so we must bind them explicitly here.
    for (const schemaBind of schemaBindees) {
      errors.push(...this.compiler.nodeReferee(schemaBind).getErrors());
    }
    // Collect errors from enum bindee (reports error if enum doesn't exist)
    errors.push(...this.compiler.nodeReferee(enumBindee).getErrors());
    // Collect errors from enum field bindee
    errors.push(...this.compiler.nodeReferee(enumFieldBindee).getErrors());

    return errors;
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

      if (tableBindee) {
        const errors: CompileError[] = [];
        // Resolve schema bindees
        for (const schemaBind of schemaBindees) {
          errors.push(...this.compiler.nodeReferee(schemaBind).getErrors());
        }
        // Resolve table bindee (reports error if table doesn't exist)
        errors.push(...this.compiler.nodeReferee(tableBindee).getErrors());
        // Resolve column bindee
        errors.push(...this.compiler.nodeReferee(columnBindee).getErrors());
        return errors;
      }
      return this.compiler.nodeReferee(columnBindee).getErrors();
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const binder = this.compiler.bindNode(sub as ElementDeclarationNode & { type: SyntaxToken });

      return binder.getErrors();
    });
  }
}
