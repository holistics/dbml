import { SyntaxToken, SyntaxTokenKind } from '../../../lexer/tokens';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, ListExpressionNode, ProgramNode, SyntaxNode } from '../../../parser/nodes';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '../../../parser/utils';
import { ElementValidator } from '../types';
import { aggregateSettingList, isSimpleName, pickValidator } from '../utils';
import _ from 'lodash';
import { getElementKind, isBinaryRelationship, isEqualTupleOperands } from '../../../analyzer/utils';
import SymbolTable from '../../../analyzer/symbol/symbolTable';
import { ElementKind } from '../../../analyzer/types';

export default class RefValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate(): CompileError[] {
    return [...this.validateContext(), ...this.validateName(this.declarationNode.name), ...this.validateAlias(this.declarationNode.alias), ...this.validateSettingList(this.declarationNode.attributeList), ...this.validateBody(this.declarationNode.body)];
  }

  private validateContext(): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || getElementKind(this.declarationNode.parent).unwrap_or(undefined) === ElementKind.Project) {
      return [];
    }
    return [new CompileError(CompileErrorCode.INVALID_REF_CONTEXT, 'A Ref must appear top-level or inside a Project', this.declarationNode)];
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [];
    }

    if (!isSimpleName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Ref\'s name is optional or must be an identifier or a quoted identifer', nameNode)];
    }

    return [];
  }

  private validateAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Ref shouldn\'t have a setting list', settingList)]
    }

    return [];
  }

  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([body]);
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])]
  }

  validateFields(fields: FunctionApplicationNode[]): CompileError[] {
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

      if (field.callee && !isEqualTupleOperands(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.UNEQUAL_FIELDS_BINARY_REF, 'Unequal fields in ref endpoints', field.callee));
      }

      const args = [...field.args];
      if (_.last(args) instanceof ListExpressionNode) {
        this.validateFieldSettings(_.last(args) as ListExpressionNode);
        args.pop();
      } else if (args[0] instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSettings(args[0]));
        args.shift();
      } 

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field should only have a single binary relationship', arg)));
      }
    });

    return errors;
  }

  validateFieldSettings(settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();
    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'delete':
        case 'update':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, `\'${name}\' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidPolicy(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, `\'${name}\' can only have values "cascade", "no action", "set null", "set default" or "restrict"`, attr));
            }
          });
          break;
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_REF_SETTING, `Unknown ref setting \'${name}\'`, attr)));
      }
    }
    return errors;
  }

  private validateSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.publicSymbolTable, this.symbolFactory);
      return validator.validate();
    });
  }
}

function isValidPolicy(value?: SyntaxNode): boolean {
  if (
    !(
      isExpressionAVariableNode(value) &&
      value.expression.variable.kind !== SyntaxTokenKind.QUOTED_STRING
    ) &&
    !(value instanceof IdentiferStreamNode)
  ) {
    return false;
  }

  let extractedString: string | undefined;
  if (value instanceof IdentiferStreamNode) {
    extractedString = extractStringFromIdentifierStream(value).unwrap_or('');
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
