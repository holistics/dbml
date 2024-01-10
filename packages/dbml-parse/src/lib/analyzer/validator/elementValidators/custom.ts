import { CompileError, CompileErrorCode } from '../../../errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode } from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { isExpressionAQuotedString } from '../../../parser/utils';
import SymbolTable from '../../../analyzer/symbol/symbolTable';

export default class CustomValidator implements ElementValidator {
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
    if (this.declarationNode.parent instanceof ProgramNode || this.declarationNode.parent?.type?.value.toLowerCase() !== 'project') {
      return [new CompileError(CompileErrorCode.INVALID_CUSTOM_CONTEXT, 'A custom element can only appear in a Project', this.declarationNode)];
    }
    return [];
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element should\'nt have a name', nameNode)];
    }

    return [];
  }

  private validateAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element should\'nt have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Custom element should\'nt have a setting list', settingList)];
    }

    return [];
  }

  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }

    if (body instanceof BlockExpressionNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_COMPLEX_BODY, 'A Custom element can only have an inline field', body)];
    }

    if (!isExpressionAQuotedString(body.callee)) {
      return [new CompileError(CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE, 'A Custom element value can only be a string', body)];
    }

    return [];
  }
}
