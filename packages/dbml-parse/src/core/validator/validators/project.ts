import { partition } from 'lodash-es';
import SymbolFactory from '@/core/validator/symbol/factory';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementValidator, ElementValidatorArgs, ElementValidatorResult } from '@/core/validator/types';
import { isSimpleName, pickElementValidator } from '@/core/validator/utils';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { NodeToSymbolMap } from '@/core/types';

export default class ProjectValidator implements ElementValidator {
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
    return { errors: [...this.validateContext(), ...this.validateName(this.declarationNode.name), ...this.validateAlias(this.declarationNode.alias), ...this.validateSettingList(this.declarationNode.attributeList), ...this.validateBody(this.declarationNode.body)] };
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_PROJECT_CONTEXT, 'A Project can only appear top-level', this.declarationNode)];
    }

    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [];
    }

    if (!isSimpleName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Project\'s name is optional or must be an identifier or a quoted identifer', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Project shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Project shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Project\'s body must be a block', body)];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...fields.map((field) => new CompileError(CompileErrorCode.INVALID_PROJECT_FIELD, 'A Project can not have inline fields', field)),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
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
