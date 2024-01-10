import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode } from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import { isExpressionAQuotedString } from '../../../parser/utils';
import _ from 'lodash';
import { pickValidator } from '../utils';
import SymbolTable from '../../../analyzer/symbol/symbolTable';

export default class NoteValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private containerSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, containerSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.containerSymbolTable = containerSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate(): CompileError[] {
    return [...this.validateContext(), ...this.validateName(this.declarationNode.name), ...this.validateAlias(this.declarationNode.alias), ...this.validateSettingList(this.declarationNode.attributeList), ...this.validateBody(this.declarationNode.body)];
  }

  validateContext(): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || this.declarationNode.parent?.type?.value.toLowerCase() !== 'table') {
      return [new CompileError(CompileErrorCode.INVALID_NOTE_CONTEXT, 'A Note can only appear inside a Table', this.declarationNode)];
    }

    return [];
  }

  validateName(nameNode?: SyntaxNode): CompileError[] {
    if (nameNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'A Note should\'nt have a name', nameNode)];
    }

    return [];
  }

  validateAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref should\'nt have an alias', aliasNode)];
    }

    return [];
  }

  validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Project should\'nt have a setting list', settingList)];
    }

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
    if (!isExpressionAQuotedString(fields[0])) {
      return [new CompileError(CompileErrorCode.INVALID_NOTE, 'A Note content must be a quoted string', fields[0])];
    }
    return [];
  }

  validateSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.declarationNode.symbol!.symbolTable!, this.symbolFactory);
      return validator.validate();
    });
  }
}
