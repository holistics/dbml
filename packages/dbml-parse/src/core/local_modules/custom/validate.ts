import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/types/nodes';
import Compiler from '@/compiler';
import { isExpressionAQuotedString } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';

export default class CustomValidator {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
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
    if (this.declarationNode.parent instanceof ProgramNode || !this.declarationNode.parent?.isKind(ElementKind.Project)) {
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
