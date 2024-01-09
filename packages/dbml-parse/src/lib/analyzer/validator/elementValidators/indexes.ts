import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../parser/utils';
import { aggregateSettingList, isVoid, pickValidator } from '../utils';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import _ from 'lodash';
import { destructureIndexNode } from '../../../analyzer/utils';
import SymbolTable from '../../../analyzer/symbol/symbolTable';

export default class IndexesValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private containerSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, containerSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.containerSymbolTable = containerSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate(): CompileError[] {
    return [...this.validateContext(), ...this.validateName(), ...this.validateAlias(), ...this.validateSettingList(), ...this.validateBody()];
  }

  validateContext(): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || this.declarationNode.parent?.type?.value.toLowerCase() !== 'table') {
      return [new CompileError(CompileErrorCode.INVALID_NOTE_CONTEXT, 'An Indexes can only appear inside a Table', this.declarationNode)];
    }

    return [];
  }

  validateName(nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'An Indexes should\'nt have a name', nameNode)];
    }

    return [];
  }

  validateAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'An Indexes should\'nt have an alias', aliasNode)];
    }

    return [];
  }

  validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Project should\'nt have a setting list', settingList)];
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
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const errors: CompileError[] = [];
      const maybeSettingList = _.last(field.args);
      if (maybeSettingList instanceof ListExpressionNode) {
        field.args.pop();
        errors.push(...this.validateFieldSetting(maybeSettingList));
      }

      [field.callee, ...field.args].forEach((sub) => {
        if (!destructureIndexNode(sub).isOk()) {
          errors.push(new CompileError(CompileErrorCode.INVALID_INDEXES_FIELD, 'An inline index field must be an identifier or a quoted identifier', sub));
        }
      });

      return errors;
    })
  }

  validateFieldSetting(settings: ListExpressionNode): CompileError[] {
    const aggRes = aggregateSettingList(settings);
    const errors = aggRes.getErrors();
    const settingMap = aggRes.getValue();

    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'note':
        case 'name':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `${name} can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `${name} must be a string`, attr));
            }
          });
        case 'unique':
        case 'pk':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `${name} can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `${name} must not have a value`, attr));
            }
          });
        case 'type':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `type can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `type must be "btree" or "hash"`, attr));
            }
          });
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_INDEX_SETTING, `Unknown index setting ${name}`, attr)));
      }
    }
    return errors;
  }

  validateSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.declarationNode.symbol!.symbolTable!, this.symbolFactory);
      return validator.validate();
    });
  }
}

export function isValidIndexesType(value?: SyntaxNode): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable?.value;

  return str === 'btree' || str === 'hash';
}
