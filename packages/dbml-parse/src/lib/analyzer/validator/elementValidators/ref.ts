/* eslint-disable class-methods-use-this */
import _, { forIn } from 'lodash';
import { SyntaxToken, SyntaxTokenKind } from '../../../lexer/tokens';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode,
  ListExpressionNode, SyntaxNode,
} from '../../../parser/nodes';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '../../../parser/utils';
import { ElementValidator } from '../types';
import { aggregateSettingList, generateUnknownSettingErrors } from '../utils';
import { isBinaryRelationship, isEqualTupleOperands } from '../../utils';
import SymbolTable from '../../symbol/symbolTable';
import { ElementKindName, SettingName } from '../../types';
import CommonValidator from '../commonValidator';

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

  const extractedString = (value instanceof IdentiferStreamNode)
    ? extractStringFromIdentifierStream(value).unwrap_or('')
    : value.expression.variable.value;

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

export default class RefValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
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
    return CommonValidator.validateTopLevelContext(this.declarationNode, ElementKindName.Ref);
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    return CommonValidator.validateOptionalSimpleName(nameNode, ElementKindName.Ref);
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return CommonValidator.validateNoAlias(aliasNode, ElementKindName.Ref);
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    return CommonValidator.validateNoSettingList(settingList, ElementKindName.Ref);
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
        const errs = this.validateFieldSettings(_.last(args) as ListExpressionNode);
        errors.push(...errs);
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

  validateFieldSettings (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Delete:
        case SettingName.Update:
          errors.push(...CommonValidator.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_REF_SETTING));
          attrs.forEach((attr) => {
            if (!isValidPolicy(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_REF_SETTING_VALUE,
                `'${name}' can only have values "cascade", "no action", "set null", "set default" or "restrict"`,
                attr,
              ));
            }
          });
          break;

        case SettingName.Color:
          errors.push(...CommonValidator.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_REF_SETTING));
          errors.push(...CommonValidator.validateColorSetting(name, attrs, CompileErrorCode.INVALID_REF_SETTING_VALUE));
          break;

        default:
          errors.push(...generateUnknownSettingErrors(name, attrs, CompileErrorCode.UNKNOWN_REF_SETTING));
      }
    });

    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return CommonValidator.validateSubElementsWithOwnedValidators(
      subs,
      this.declarationNode,
      this.publicSymbolTable,
      this.symbolFactory,
    );
  }
}
