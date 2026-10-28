import { last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind } from '@/core/types/keywords';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  ProgramNode,
  SyntaxNode,
} from '@/core/types/nodes';
import {
  isExpressionAQuotedString,
  aggregateSettingList,
} from '@/core/utils/validate';

export default class ChecksValidator {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
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
    const invalidContextError = new CompileError(
      CompileErrorCode.INVALID_CHECKS_CONTEXT,
      'A Checks can only appear inside a Table or a TablePartial',
      this.declarationNode,
    );
    if (this.declarationNode.parent instanceof ProgramNode) return [
      invalidContextError,
    ];

    return (this.declarationNode.parent?.isKind(ElementKind.Table, ElementKind.TablePartial))
      ? []
      : [
          invalidContextError,
        ];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Checks shouldn\'t have a name', nameNode),
      ];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Checks shouldn\'t have an alias', aliasNode),
      ];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Checks shouldn\'t have a setting list', settingList),
      ];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Checks must have a complex body', body),
      ];
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (element) => element instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const errors: CompileError[] = [];
      const args = [
        field.callee,
        ...field.args,
      ];
      if (last(args) instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSetting(args.pop() as ListExpressionNode));
      }

      if (args.length > 1 || !(args[0] instanceof FunctionExpressionNode)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_CHECKS_FIELD, 'A check field must be a function expression', field));
      }

      return errors;
    });
  }

  private validateFieldSetting (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const [
      name,
      attributes,
    ] of Object.entries(settingMap)) {
      switch (name) {
        case 'name':
          if (attributes.length > 1) {
            attributes.forEach((attribute) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_CHECK_SETTING, `'${name}' can only appear once`, attribute)));
          }
          attributes.forEach((attribute) => {
            if (!isExpressionAQuotedString(attribute.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_CHECK_SETTING_VALUE, `'${name}' must be a string`, attribute));
            }
          });
          break;
        default:
          attributes.forEach((attribute) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_CHECK_SETTING, `Unknown check setting '${name}'`, attribute)));
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
