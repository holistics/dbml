import { partition, last } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/parser/nodes';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '@/core/utils/expression';
import { aggregateSettingList, isValidColor, Settings } from '@/core/utils/validate';
import { destructureComplexVariable, destructureComplexVariableTuple, isBinaryRelationship, isEqualTupleOperands } from '@/core/utils/expression';
import { SyntaxTokenKind } from '@/core/lexer/tokens';
import Report from '@/core/report';
import { SettingName } from '@/core/types/keywords';
import { TupleExpressionNode } from '@/core/parser/nodes';

export default class RefValidator {
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
    if (this.declarationNode.parent instanceof ProgramNode) {
      return [];
    }
    return [new CompileError(CompileErrorCode.INVALID_REF_CONTEXT, 'A Ref must appear top-level', this.declarationNode)];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    return this.compiler.fullname(this.declarationNode).getErrors();
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Ref shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([body]);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    if (fields.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_REF, 'A Ref must have at least one field', this.declarationNode)];
    }

    const errors: CompileError[] = [];
    if (fields.length > 1) {
      errors.push(...fields.slice(1).map((field) => new CompileError(CompileErrorCode.REF_REDEFINED, 'A Ref can only contain one binary relationship', field)));
    }

    fields.forEach((field) => {
      if (field.callee && !isBinaryRelationship(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field must be a binary relationship', field.callee));
      }

      if (field.callee && isBinaryRelationship(field.callee)) {
        const leftOk = this.isValidRefColumnReference(field.callee.leftExpression);
        const rightOk = this.isValidRefColumnReference(field.callee.rightExpression);
        if (!leftOk) {
          errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'Invalid column reference', field.callee.leftExpression || field.callee));
        }
        if (!rightOk) {
          errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'Invalid column reference', field.callee.rightExpression || field.callee));
        }
      }

      if (field.callee && !isEqualTupleOperands(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.UNEQUAL_FIELDS_BINARY_REF, 'Unequal fields in ref endpoints', field.callee));
      }

      const args = [...field.args];
      if (last(args) instanceof ListExpressionNode) {
        const errs = validateFieldSettings(last(args) as ListExpressionNode);
        errors.push(...errs.getErrors());
        args.pop();
      } else if (args[0] instanceof ListExpressionNode) {
        errors.push(...validateFieldSettings(args[0]).getErrors());
        args.shift();
      }

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field should only have a single binary relationship', arg)));
      }
    });

    return errors;
  }

  private isValidRefColumnReference (node?: SyntaxNode): boolean {
    if (!node) return false;
    const fragment = destructureComplexVariableTuple(node);
    if (fragment) {
      const count = fragment.variables.length + Math.min(fragment.tupleElements.length, 1);
      return count >= 2;
    }
    // Standalone tuple of dotted chains
    if (node instanceof TupleExpressionNode) {
      return node.elementList.length > 0 && node.elementList.every((e) => {
        const v = destructureComplexVariable(e);
        return v !== undefined && v.length >= 2;
      });
    }
    return false;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      return this.compiler.validate(sub).getErrors();
    });
  }
}

export function validateFieldSettings (settings: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settings);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();
  const clean: Settings = {};

  for (const [name, attrs] of Object.entries(settingMap)) {
    switch (name) {
      case SettingName.Delete:
      case SettingName.Update:
        if (attrs.length > 1) {
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, `'${name}' can only appear once`, attr)));
        }
        attrs.forEach((attr) => {
          if (!isValidPolicy(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, `'${name}' can only have values "cascade", "no action", "set null", "set default" or "restrict"`, attr));
          }
        });
        clean[name] = attrs;
        break;
      case SettingName.Color:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, '\'color\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (!isValidColor(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, '\'color\' must be a color literal', attr!));
          }
        });
        clean[name] = attrs;
        break;
      default:
        attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_REF_SETTING, `Unknown ref setting '${name}'`, attr)));
    }
  }
  return new Report(clean, errors);
}

function isValidPolicy (value?: SyntaxNode): boolean {
  if (
    !(
      isExpressionAVariableNode(value)
      && value.expression.variable.kind !== SyntaxTokenKind.QUOTED_STRING
    )
    && !(value instanceof IdentiferStreamNode)
  ) {
    return false;
  }

  let extractedString: string | undefined;
  if (value instanceof IdentiferStreamNode) {
    extractedString = extractStringFromIdentifierStream(value) ?? '';
  } else {
    extractedString = value.expression.variable.value;
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}
