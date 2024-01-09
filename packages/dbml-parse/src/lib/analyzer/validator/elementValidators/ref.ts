import { SyntaxToken, SyntaxTokenKind } from '../../../lexer/tokens';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, ListExpressionNode, ProgramNode, SyntaxNode } from '../../../parser/nodes';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '../../../parser/utils';
import { ElementValidator } from '../types';
import { aggregateSettingList, isSimpleName, pickValidator } from '../utils';
import _ from 'lodash';
import { isBinaryRelationship } from '../../../analyzer/utils';
import SymbolTable from '../../../analyzer/symbol/symbolTable';

export default class RefValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private containerSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, containerSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.containerSymbolTable = containerSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate(): CompileError[] {
    return [...this.validateContext(), ...this.validateName(), ...this.validateAlias(), ...this.validateSettingList(), ...this.validateBody()];
  }

  validateContext(): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode || this.declarationNode.parent!.type?.value.toLowerCase() === 'table') {
      return [];
    }
    return [new CompileError(CompileErrorCode.INVALID_REF_CONTEXT, 'A Ref must appear top-level or inside a table', this.declarationNode)];
  }

  validateName(nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [];
    }

    if (!isSimpleName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Ref\'s name is optional or must be an identifier or a quoted identifer', nameNode)];
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
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Ref should\'nt have a setting list', settingList)]
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
    if (fields.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_REF, 'A Ref must have at least one field', this.declarationNode)];
    }

    return fields.flatMap((field) => {
      const errors: CompileError[] = []
      if (field.callee && !isBinaryRelationship(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field must be a binary relationship', field.callee));
      }

      if (_.last(field.args) instanceof ListExpressionNode) {
        this.validateFieldSettings(field.args.pop() as ListExpressionNode);
      }

      if (field.args.length > 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Ref field should only have a single binary relationship', field.args));
      }

      return errors;
    })
  }

  validateFieldSettings(settings: ListExpressionNode): CompileError[] {
    const aggRes = aggregateSettingList(settings);
    const errors = aggRes.getErrors();
    const settingMap = aggRes.getValue();
    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'delete':
        case 'update':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, `${name} can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidPolicy(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, `${name} can only have values "cascade", "no action", "set null", "set default" or "restrict"`, attr));
            }
          });
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_REF_SETTING, `Unknown ref setting ${name}`, attr)));
      }
    }
    return errors;
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

function isValidPolicy(value?: SyntaxNode): boolean {
  if (
    !(
      isExpressionAVariableNode(value) &&
      value.expression.variable.kind !== SyntaxTokenKind.QUOTED_STRING
    ) &&
    !(value instanceof IdentiferStreamNode)
  ) {
    return false;
  }

  let extractedString: string | undefined;
  if (value instanceof IdentiferStreamNode) {
    extractedString = extractStringFromIdentifierStream(value).unwrap_or('');
  } else {
    extractedString = value.expression.variable.value;
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}
