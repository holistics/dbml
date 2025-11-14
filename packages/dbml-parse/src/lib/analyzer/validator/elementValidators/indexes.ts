import { last, partition } from 'lodash-es';
import SymbolFactory from '@analyzer/symbol/factory';
import { CompileError, CompileErrorCode } from '@lib/errors';
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
} from '@parser/nodes';
import { isExpressionAQuotedString, isExpressionAVariableNode } from '@parser/utils';
import { aggregateSettingList } from '@analyzer/validator/utils';
import { isVoid, pickValidator } from '@analyzer/validator/utils';
import { SyntaxToken } from '@lexer/tokens';
import { ElementValidator } from '@analyzer/validator/types';
import { destructureIndexNode, getElementKind } from '@analyzer/utils';
import SymbolTable from '@analyzer/symbol/symbolTable';
import { ElementKind } from '@analyzer/types';

export default class IndexesValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
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
    const invalidContextError = new CompileError(
      CompileErrorCode.INVALID_INDEXES_CONTEXT,
      'An Indexes can only appear inside a Table or a TablePartial',
      this.declarationNode,
    );
    if (this.declarationNode.parent instanceof ProgramNode) return [invalidContextError];

    const elementKind = getElementKind(this.declarationNode.parent).unwrap_or(undefined);
    return (elementKind && [ElementKind.Table, ElementKind.TablePartial].includes(elementKind))
      ? []
      : [invalidContextError];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'An Indexes shouldn\'t have a name', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'An Indexes shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'An Indexes shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'An Indexes must have a complex body', body)];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const errors: CompileError[] = [];
      const args = [field.callee, ...field.args];
      if (last(args) instanceof ListExpressionNode) {
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
    });
  }

  private validateFieldSetting (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'note':
        case 'name':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `'${name}' must be a string`, attr));
            }
          });
          break;
        case 'unique':
        case 'pk':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `'${name}' must not have a value`, attr));
            }
          });
          break;
        case 'type':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, '\'type\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAVariableNode(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, '\'type\' must be "btree" or "hash"', attr));
            }
          });
          break;
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_INDEX_SETTING, `Unknown index setting '${name}'`, attr)));
      }
    }
    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
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

export function isValidIndexesType (value?: SyntaxNode): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable?.value;

  return str === 'btree' || str === 'hash';
}
