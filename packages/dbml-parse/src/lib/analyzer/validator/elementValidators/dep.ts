import { forIn, last, partition } from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  ProgramNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../parser/utils';
import { aggregateSettingList, isValidName, pickValidator } from '../utils';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { isValidDependency } from '../../utils';
import SymbolTable from '../../symbol/symbolTable';
import { SettingName } from '../../types';

export default class DepValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
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
      CompileErrorCode.INVALID_TABLE_DEP_CONTEXT,
      'A Dep can only appear top-level',
      this.declarationNode,
    );
    if (this.declarationNode.parent instanceof ProgramNode) return [];
    return [invalidContextError];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) return [];
    if (!isValidName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Dep name must be of the form <dep> or <schema>.<dep>', nameNode)];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Dep shouldn\'t have an alias', aliasNode)];
    }
    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_DEP_SETTING, '\'note\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_DEP_SETTING_VALUE, '\'note\' must be a string literal', attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_DEP_SETTING, `Unknown '${name}' setting`, attr)));
      }
    });
    return errors;
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    const errors = [];
    if (!body) {
      return [];
    }
    if (body instanceof BlockExpressionNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_COMPLEX_BODY, 'A Dep must have a simple body', body)];
    }
    if (!body.callee || !isValidDependency(body.callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_DEP, 'Invalid table dependency specification', body));
    }
    if (body.args.length > 2) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_DEP, 'Invalid table dependency specification', body));
    }
    let settingList: ListExpressionNode | undefined;
    let block: BlockExpressionNode | undefined;
    if (body.args.length === 2) {
      if (body.args[1] instanceof BlockExpressionNode && body.args[0] instanceof ListExpressionNode) {
        settingList = body.args[0] as ListExpressionNode;
        block = body.args[1] as BlockExpressionNode;
      } else {
        errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_DEP, 'Invalid table dependency specification', body));
      }
    }
    if (body.args.length === 1) {
      if (body.args[0] instanceof BlockExpressionNode) {
        block = body.args[0];
      } else if (body.args[0] instanceof ListExpressionNode) {
        settingList = body.args[0];
      } else {
        errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_DEP, 'Invalid table dependency specification', body));
      }
    }

    if (settingList) {
      errors.push(...this.validateSettingList(settingList));
    }
    if (block) {
      const [fields, subs] = partition(block.body, (e) => e instanceof FunctionApplicationNode);
      errors.push(...this.validateFields(fields as FunctionApplicationNode[]));
      errors.push(...this.validateSubElements(subs));
    }
    return errors;
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

      if (args.length > 1 || !isValidDependency(args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_FIELD_DEP, 'Invalid field dependency specification', field));
      }

      return errors;
    });
  }

  private validateFieldSetting (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_FIELD_DEP_SETTING, '\'note\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_FIELD_DEP_SETTING_VALUE, '\'note\' must be a string literal', attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_FIELD_DEP_SETTING, `Unknown '${name}' setting`, attr)));
      }
    });
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
