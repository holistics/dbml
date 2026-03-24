import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/parser/nodes';
import SymbolFactory from '@/core/validator/symbol/factory';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementValidator, ElementValidatorArgs, ElementValidatorResult } from '@/core/validator/types';
import { isExpressionAQuotedString } from '@/core/parser/utils';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { getElementKind } from '@/core/utils';
import { ElementKind } from '@/core/types';
import { NodeToSymbolMap } from '@/core/types';

export default class CustomValidator implements ElementValidator {
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
    if (this.declarationNode.parent instanceof ProgramNode || getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Project) {
      return [new CompileError(CompileErrorCode.INVALID_CUSTOM_CONTEXT, 'A Custom element can only appear in a Project', this.declarationNode, this.symbolFactory.filepath)];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element shouldn\'t have a name', nameNode, this.symbolFactory.filepath)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Custom element shouldn\'t have an alias', aliasNode, this.symbolFactory.filepath)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Custom element shouldn\'t have a setting list', settingList, this.symbolFactory.filepath)];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }

    if (body instanceof BlockExpressionNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_COMPLEX_BODY, 'A Custom element can only have an inline field', body, this.symbolFactory.filepath)];
    }

    const errors: CompileError[] = [];

    if (!isExpressionAQuotedString(body.callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE, 'A Custom element value can only be a string', body, this.symbolFactory.filepath));
    }
    if (body.args.length > 0) {
      errors.push(...body.args.map((arg) => new CompileError(CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE, 'A Custom element value can only be a string', arg, this.symbolFactory.filepath)));
    }

    return errors;
  }
}
