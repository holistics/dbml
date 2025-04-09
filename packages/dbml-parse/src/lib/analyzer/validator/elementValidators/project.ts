/* eslint-disable class-methods-use-this */
import _ from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';
import SymbolTable from '../../symbol/symbolTable';
import { ElementKindName } from '../../types';
import ElementValidator from './elementValidator';

export default class ProjectValidator extends ElementValidator {
  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    super(declarationNode, publicSymbolTable, symbolFactory, ElementKindName.Project);
  }

  protected validateContext (): CompileError[] {
    return this.validateTopLevelContext(this.declarationNode);
  }

  protected validateName (nameNode?: SyntaxNode): CompileError[] {
    return this.validateOptionalSimpleName(nameNode);
  }

  protected validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return this.validateNoAlias(aliasNode);
  }

  protected validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    return this.validateNoSettingList(settingList);
  }

  protected registerElement (): CompileError[] {
    return [];
  }

  protected validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Project\'s body must be a block', body)];
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...fields.map((field) => new CompileError(CompileErrorCode.INVALID_PROJECT_FIELD, 'A Project can not have inline fields', field)),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return this.validateSubElementsWithOwnedValidators(
      subs,
      this.declarationNode,
      this.publicSymbolTable,
      this.symbolFactory,
    );
  }
}
