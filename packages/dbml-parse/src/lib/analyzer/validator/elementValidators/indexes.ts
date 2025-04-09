/* eslint-disable class-methods-use-this */
import _, { forIn } from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isExpressionAVariableNode } from '../../../parser/utils';
import { aggregateSettingList } from '../utils';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { destructureIndexNode, getElementKind } from '../../utils';
import SymbolTable from '../../symbol/symbolTable';
import { ElementKind, ElementKindName, SettingName } from '../../types';
import CommonValidator from '../commonValidator';

export default class IndexesValidator implements ElementValidator {
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

  private validateContext(): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Table) {
      return [new CompileError(CompileErrorCode.INVALID_NOTE_CONTEXT, 'An Indexes can only appear inside a Table', this.declarationNode)];
    }

    return [];
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'An Indexes shouldn\'t have a name', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return CommonValidator.validateNoAlias(aliasNode, ElementKindName.Indexes);
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    return CommonValidator.validateNoSettingList(settingList, ElementKindName.Indexes);
  }

  private validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'An Indexes must have a complex body', body)];
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])]
  }

  private validateFields(fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const errors: CompileError[] = [];
      const args = [field.callee, ...field.args];
      if (_.last(args) instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSetting(args.pop() as ListExpressionNode));
      }

      args.forEach((sub) => {
        // This is to deal with inline indexes field such as
        // (id, name) (age, weight)
        // which is parsed as a call expression
        while (sub instanceof CallExpressionNode) {
          if (sub.argumentList && !destructureIndexNode(sub.argumentList).isOk()) { 
            errors.push(new CompileError(CompileErrorCode.INVALID_INDEXES_FIELD, 'An index field must be an identifier, a quoted identifier, a functional expression or a tuple of such', sub.argumentList));
          }
          sub = sub.callee!;
        }

        if (!destructureIndexNode(sub).isOk()) {
          errors.push(new CompileError(CompileErrorCode.INVALID_INDEXES_FIELD, 'An index field must be an identifier, a quoted identifier, a functional expression or a tuple of such', sub));
        }
      });

      return errors;
    })
  }

  private validateFieldSetting (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
        case SettingName.Name:
          errors.push(...CommonValidator.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_INDEX_SETTING));
          errors.push(...CommonValidator.validateStringSetting(name, attrs, CompileErrorCode.INVALID_INDEX_SETTING_VALUE));
          break;

        case SettingName.Unique:
        case SettingName.PK:
          errors.push(...CommonValidator.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_INDEX_SETTING));
          errors.push(...CommonValidator.validateNonValueSetting(name, attrs, CompileErrorCode.INVALID_INDEX_SETTING_VALUE));
          break;

        case SettingName.Type:
          errors.push(...CommonValidator.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_INDEX_SETTING));
          attrs.forEach((attr) => {
            if (!isExpressionAVariableNode(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, '\'type\' must be "btree" or "hash"', attr));
            }
          });
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_INDEX_SETTING, `Unknown index setting '${name}'`, attr)));
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

export function isValidIndexesType(value?: SyntaxNode): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable?.value;

  return str === 'btree' || str === 'hash';
}
