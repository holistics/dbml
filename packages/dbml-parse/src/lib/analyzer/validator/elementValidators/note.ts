import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode } from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { isExpressionAQuotedString } from '../../../parser/utils';
import _ from 'lodash';
import { pickValidator } from '../utils';
import SymbolTable from '../../../analyzer/symbol/symbolTable';
import { ElementKind } from '../../../analyzer/types';
import { getElementKind } from '../../../analyzer/utils';

export default class NoteValidator implements ElementValidator {
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
    if (
      !(this.declarationNode.parent instanceof ProgramNode)
      && !([ElementKind.Table, ElementKind.Project] as (ElementKind | undefined)[]).includes(getElementKind(this.declarationNode.parent).unwrap_or(undefined))
    ) {
      return [new CompileError(CompileErrorCode.INVALID_NOTE_CONTEXT, 'A Note can only appear inside a Table or a Project', this.declarationNode)];
    }

    return [];
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
    // if (nameNode) {
    //   return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Note shouldn\'t have a name', nameNode)];
    // }

    return [];
  }

  private validateAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    // if (settingList) {
    //   return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Note shouldn\'t have a setting list', settingList)];
    // }

    return [];
  }

  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([body]);
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])]
  }

  validateFields(fields: FunctionApplicationNode[]): CompileError[] {
    const errors: CompileError[] = [];
    if (fields.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_NOTE, 'A Note must have a content', this.declarationNode)];
    }
    if (fields.length > 1) {
      fields.slice(1).forEach((field) => errors.push(new CompileError(CompileErrorCode.NOTE_CONTENT_REDEFINED, 'A Note can only contain one string', field)));
    }
    if (!isExpressionAQuotedString(fields[0].callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_NOTE, 'A Note content must be a quoted string', fields[0]));
    }
    if (fields[0].args.length > 0) {
      errors.push(...fields[0].args.map((arg) => new CompileError(CompileErrorCode.INVALID_NOTE, 'A Note can only contain one quoted string', arg)));
    }
    return errors;
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
