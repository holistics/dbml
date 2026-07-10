import { last, partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, InfixExpressionNode, ListExpressionNode, ProgramNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import { SettingName } from '@/core/types/keywords';
import { DEP_DOWNSTREAM, DEP_UPSTREAM } from '@/core/types/schemaJson';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import {
  Settings, aggregateSettingList, isSimpleName, isValidColor, isExpressionAQuotedString,
  isExpressionASignedNumberExpression,
} from '@/core/utils/validate';

export default class DepValidator {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettings(),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateSettings (): CompileError[] {
    const errors: CompileError[] = [];
    // Header attribute list
    if (this.declarationNode.attributeList) {
      errors.push(...validateDepSettings(this.declarationNode.attributeList).getErrors());
    }
    // Short-form body settings list
    const body = this.declarationNode.body;
    if (body instanceof FunctionApplicationNode) {
      const settingsList = body.args.find((a) => a instanceof ListExpressionNode) as ListExpressionNode | undefined;
      if (settingsList) {
        errors.push(...validateDepSettings(settingsList).getErrors());
      }
    }
    return errors;
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode) {
      return [];
    }
    return [
      new CompileError(CompileErrorCode.INVALID_DEP_CONTEXT, 'A Dep must appear top-level', this.declarationNode),
    ];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) return [];
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Dep name', nameNode),
      ];
    }
    if (!isSimpleName(nameNode)) {
      return [
        new CompileError(CompileErrorCode.INVALID_NAME, 'A Dep\'s name is optional or must be an identifier or a quoted identifier', nameNode),
      ];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Dep shouldn\'t have an alias', aliasNode),
      ];
    }
    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([
        body,
      ]);
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    const errors: CompileError[] = [];

    fields.forEach((field) => {
      if (!field.callee) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'A Dep field must be a binary relationship', field));
        return;
      }
      if (!(field.callee instanceof InfixExpressionNode)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'A Dep field must be a binary relationship', field.callee));
        return;
      }

      const infix = field.callee;
      if (infix.op?.value !== DEP_DOWNSTREAM && infix.op?.value !== DEP_UPSTREAM) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'Dep edges must use the \'->\' or \'<-\' operator', field.callee));
      }

      const leftFragment = destructureComplexVariableTuple(infix.leftExpression) ?? { variables: [], tupleElements: [] };
      const rightFragment = destructureComplexVariableTuple(infix.rightExpression) ?? { variables: [], tupleElements: [] };
      if (leftFragment.variables.length === 0 && leftFragment.tupleElements.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'Invalid Dep endpoint', infix.leftExpression || field.callee));
      }
      if (rightFragment.variables.length === 0 && rightFragment.tupleElements.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'Invalid Dep endpoint', infix.rightExpression || field.callee));
      }

      const args = [
        ...field.args,
      ];
      if (last(args) instanceof ListExpressionNode) args.pop();
      else if (args[0] instanceof ListExpressionNode) args.shift();

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_DEP_FIELD, 'A Dep field should only have a single binary relationship', arg)));
      }
    });

    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) return [];
      const key = sub.type.value?.toLowerCase();
      const subBody = sub.body;
      if (!key || !(subBody instanceof FunctionApplicationNode) || !subBody.callee) return [];

      switch (key) {
        case SettingName.Color:
          if (!isValidColor(subBody.callee)) {
            return [new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Invalid color value. Expected a hex color (e.g. #fff or #aabbcc)', sub)];
          }
          return [];
        case SettingName.Note:
          if (!isExpressionAQuotedString(subBody.callee)) {
            return [new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Invalid note value. Expected a quoted string', sub)];
          }
          return [];
        default:
          if (!isExpressionAQuotedString(subBody.callee)
            && !isValidColor(subBody.callee)
            && !isExpressionASignedNumberExpression(subBody.callee)
            && !isSimpleName(subBody.callee)) {
            return [new CompileError(CompileErrorCode.INVALID_SETTINGS, `Invalid value for '${key}'. Expected a string, number, color, or identifier`, sub)];
          }
          return [];
      }
    });
  }
}

export function validateDepSettings (settings: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settings);
  const errors: CompileError[] = [...aggReport.getErrors()];
  const settingMap = aggReport.getValue();

  for (const [name, attrs] of Object.entries(settingMap)) {
    for (const attr of attrs) {
      switch (name) {
        case SettingName.Color:
          if (!isValidColor(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Invalid color value. Expected a hex color (e.g. #fff or #aabbcc)', attr));
          }
          break;
        case SettingName.Note:
          if (!isExpressionAQuotedString(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Invalid note value. Expected a quoted string', attr));
          }
          break;
        default:
          if (attr.value
            && !isExpressionAQuotedString(attr.value)
            && !isValidColor(attr.value)
            && !isExpressionASignedNumberExpression(attr.value)
            && !isSimpleName(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, `Invalid value for setting '${name}'. Expected a string, number, color, or identifier`, attr));
          }
          break;
      }
    }
  }

  return new Report(settingMap, errors);
}
