import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode, WildcardNode } from '@/core/types/nodes';
import { isElementFieldNode, isExpressionAQuotedString, isExpressionAVariableNode } from '@/core/utils/expression';
import { aggregateSettingList, isValidName } from '@/core/utils/validate';
import { last, partition } from 'lodash-es';

export default class EnumValidator {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  static validateField (compiler: Compiler, node: FunctionApplicationNode): CompileError[] {
    const errors: CompileError[] = [];

    if (node.callee && !isExpressionAVariableNode(node.callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT_NAME, 'An enum field must be an identifier or a quoted identifier', node.callee));
    }

    const args = [...node.args];
    if (last(args) instanceof ListExpressionNode) {
      const aggReport = aggregateSettingList(last(args) as ListExpressionNode);
      errors.push(...aggReport.getErrors());
      args.pop();
    } else if (args[0] instanceof ListExpressionNode) {
      const aggReport = aggregateSettingList(args[0]);
      errors.push(...aggReport.getErrors());
      args.shift();
    }

    if (args.length > 0) {
      errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT, 'An Enum must have only a field and optionally a setting list', arg)));
    }

    return errors;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    const parent = this.declarationNode.parent;
    if (parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_PROJECT_CONTEXT, 'An Enum can only appear top-level', this.declarationNode)];
    }

    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'An Enum must have a name', this.declarationNode)];
    }
    if (nameNode instanceof WildcardNode) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as an Enum name', nameNode)];
    }
    if (!isValidName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'An Enum name must be of the form <enum> or <schema>.<enum>', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'An Enum shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'An Enum shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([body]);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    if (fields.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_ENUM, 'An Enum must have at least one element', this.declarationNode)];
    }

    return fields.flatMap((field) => {
      const errors: CompileError[] = [];

      if (field.callee && !isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT_NAME, 'An enum field must be an identifier or a quoted identifier', field.callee));
      }

      const args = [...field.args];
      if (last(args) instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSettings(last(args) as ListExpressionNode));
        args.pop();
      } else if (args[0] instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSettings(args[0]));
        args.shift();
      }

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT, 'An Enum must have only a field and optionally a setting list', arg)));
      }

      return errors;
    });
  }

  private validateFieldSettings (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const name in settingMap) {
      const attrs = settingMap[name];
      if (!attrs) continue;
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING, '\'note\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING, '\'note\' must be a string', attr));
            }
          });
          break;
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_ENUM_ELEMENT_SETTING, `Unknown enum field setting '${name}'`, attr)));
      }
    }
    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validateNode(sub).getErrors();
    });
  }
}
