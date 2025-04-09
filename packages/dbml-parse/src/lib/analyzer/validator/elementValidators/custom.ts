/* eslint-disable class-methods-use-this */
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../parser/utils';
import { getElementKind } from '../../utils';
import { ElementKind, ElementKindName } from '../../types';
import ElementValidator from './elementValidator';
import { SyntaxToken } from '../../../lexer/tokens';
import SymbolTable from '../../symbol/symbolTable';
import SymbolFactory from '../../symbol/factory';

export default class CustomValidator extends ElementValidator {
  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    super(declarationNode, publicSymbolTable, symbolFactory, ElementKindName.Custom);
  }

  protected validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Project) {
      return [new CompileError(CompileErrorCode.INVALID_CUSTOM_CONTEXT, 'A custom element can only appear in a Project', this.declarationNode)];
    }
    return [];
  }

  protected validateName (nameNode?: SyntaxNode): CompileError[] {
    return !nameNode
      ? []
      : [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element shouldn\'t have a name', nameNode)];
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

    if (body instanceof BlockExpressionNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_COMPLEX_BODY, 'A Custom element can only have an inline field', body)];
    }

    const errors: CompileError[] = [];

    if (!isExpressionAQuotedString(body.callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE, 'A Custom element value can only be a string', body));
    }
    if (body.args.length > 0) {
      errors.push(...body.args.map((arg) => new CompileError(CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE, 'A Custom element value can only be a string', arg)));
    }

    return errors;
  }
}
