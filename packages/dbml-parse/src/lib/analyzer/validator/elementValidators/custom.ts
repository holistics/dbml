import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { isExpressionAQuotedString } from '../../../parser/utils';
import SymbolTable from '../../symbol/symbolTable';
import { getElementKind } from '../../utils';
import { ElementKind } from '../../types';

export default class CustomValidator implements ElementValidator {
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
    if (this.declarationNode.parent instanceof ProgramNode || getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Project) {
      return [new CompileError(CompileErrorCode.INVALID_CUSTOM_CONTEXT, 'A Custom element can only appear in a Project', this.declarationNode)];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element shouldn\'t have a name', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Custom element shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
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
