import { last, partition } from 'lodash-es';
import SymbolFactory from '@/core/validator/symbol/factory';
import { NodeToSymbolMap } from '@/core/types';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  ProgramNode,
  SyntaxNode,
} from '@/core/parser/nodes';
import { isExpressionAQuotedString } from '@/core/parser/utils';
import { aggregateSettingList, pickElementValidator } from '@/core/validator/utils';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementValidator, ElementValidatorArgs, ElementValidatorResult } from '@/core/validator/types';
import { getElementKind } from '@/core/utils';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { ElementKind } from '@/core/types';

export default class ChecksValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;
  private nodeToSymbol: NodeToSymbolMap;

  constructor ({ declarationNode, publicSymbolTable, nodeToSymbol }: ElementValidatorArgs, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
    this.nodeToSymbol = nodeToSymbol;
  }

  validate (): ElementValidatorResult {
    return {
      errors: [
        ...this.validateContext(),
        ...this.validateName(this.declarationNode.name),
        ...this.validateAlias(this.declarationNode.alias),
        ...this.validateSettingList(this.declarationNode.attributeList),
        ...this.validateBody(this.declarationNode.body),
      ],
    };
  }

  private validateContext (): CompileError[] {
    const invalidContextError = new CompileError(
      CompileErrorCode.INVALID_CHECKS_CONTEXT,
      'A Checks can only appear inside a Table or a TablePartial',
      this.declarationNode, this.symbolFactory.filepath);
    if (this.declarationNode.parent instanceof ProgramNode) return [invalidContextError];

    const elementKind = getElementKind(this.declarationNode.parent).unwrap_or(undefined);
    return (elementKind && [ElementKind.Table, ElementKind.TablePartial].includes(elementKind))
      ? []
      : [invalidContextError];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Checks shouldn\'t have a name', nameNode, this.symbolFactory.filepath)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Checks shouldn\'t have an alias', aliasNode, this.symbolFactory.filepath)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Checks shouldn\'t have a setting list', settingList, this.symbolFactory.filepath)];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Checks must have a complex body', body, this.symbolFactory.filepath)];
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

      if (args.length > 1 || !(args[0] instanceof FunctionExpressionNode)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_CHECKS_FIELD, 'A check field must be a function expression', field, this.symbolFactory.filepath));
      }

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
        case 'name':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_CHECK_SETTING, `'${name}' can only appear once`, attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_CHECK_SETTING_VALUE, `'${name}' must be a string`, attr, this.symbolFactory.filepath));
            }
          });
          break;
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_CHECK_SETTING, `Unknown check setting '${name}'`, attr, this.symbolFactory.filepath)));
      }
    }
    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Validator = pickElementValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator({ declarationNode: sub as ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: this.publicSymbolTable, nodeToSymbol: this.nodeToSymbol }, this.symbolFactory);
      return validator.validate().errors;
    });
  }
}
