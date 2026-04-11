import { CompileError, CompileErrorCode, CompileWarning } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode, WildcardNode,
} from '@/core/types/nodes';
import SymbolFactory from '@/core/types/symbol/factory';
import { SyntaxToken } from '@/core/types/tokens';
import { ElementValidator } from '@/core/analyzer/validator/types';
import { isExpressionAQuotedString } from '@/core/parser/utils';
import SymbolTable from '@/core/types/symbol/symbolTable';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';

export default class CustomValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): { errors: CompileError[]; warnings: CompileWarning[] } {
    return {
      errors: [
        ...this.validateContext(),
        ...this.validateName(this.declarationNode.name),
        ...this.validateAlias(this.declarationNode.alias),
        ...this.validateSettingList(this.declarationNode.attributeList),
        ...this.validateBody(this.declarationNode.body),
      ],
      warnings: [],
    };
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || getElementKind(this.declarationNode.parent) !== ElementKind.Project) {
      return [new CompileError(CompileErrorCode.INVALID_CUSTOM_CONTEXT, 'A Custom element can only appear in a Project', this.declarationNode)];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode instanceof WildcardNode) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'Wildcard (*) is not allowed as a Custom element name', nameNode)];
    }
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
