/* eslint-disable class-methods-use-this */
import _ from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { isSimpleName, pickValidator } from '../utils';
import SymbolTable from '../../symbol/symbolTable';
import CommonValidator from '../commonValidator';
import { ElementKindName } from '../../types';

export default class ProjectValidator implements ElementValidator {
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
    return CommonValidator.validateTopLevelContext(this.declarationNode, ElementKindName.Project);
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [];
    }

    if (!isSimpleName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Project\'s name is optional or must be an identifier or a quoted identifer', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return CommonValidator.validateNoAlias(aliasNode, ElementKindName.Project);
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    return CommonValidator.validateNoSettingList(settingList, ElementKindName.Project);
  }

  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Project\'s body must be a block', body)];
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...fields.map((field) => new CompileError(CompileErrorCode.INVALID_PROJECT_FIELD, 'A Project can not have inline fields', field)),
      ...this.validateSubElements(subs as ElementDeclarationNode[])
    ];
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
