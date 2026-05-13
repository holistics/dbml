import { partition, last } from 'lodash-es';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentiferStreamNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/parser/nodes';
import {
  extractStringFromIdentifierStream,
  isExpressionAQuotedString,
} from '@/core/parser/utils';
import { ElementValidator } from '@/core/analyzer/validator/types';
import { isSimpleName, isValidColor, pickValidator, aggregateSettingList } from '@/core/analyzer/validator/utils';
import { destructureComplexVariable, destructureComplexVariableTuple, isBinaryDependency, isEqualTupleOperands } from '@/core/analyzer/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';

export default class DepValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): { errors: CompileError[]; warnings: CompileWarning[] } {
    return { errors: [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ], warnings: [] };
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ProgramNode) {
      return [];
    }
    return [new CompileError(CompileErrorCode.INVALID_REF_CONTEXT, 'A Dep must appear top-level', this.declarationNode)];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [];
    }

    if (!isSimpleName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Dep\'s name is optional or must be an identifier or a quoted identifier', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Dep shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Dep shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateFields([body]);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.validateFields(fields as FunctionApplicationNode[]), ...this.validateSubElements(subs as ElementDeclarationNode[])];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    if (fields.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_REF, 'A Dep must have at least one dependency line', this.declarationNode)];
    }

    const errors: CompileError[] = [];

    fields.forEach((field) => {
      if (field.callee && !isBinaryDependency(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Dep field must be a binary dependency (use -> or <-)', field.callee));
      }

      if (field.callee && isBinaryDependency(field.callee)) {
        const leftFragment = destructureComplexVariableTuple(field.callee.leftExpression).unwrap_or({ variables: [], tupleElements: [] });
        const rightFragment = destructureComplexVariableTuple(field.callee.rightExpression).unwrap_or({ variables: [], tupleElements: [] });
        const leftFragmentCount = leftFragment.variables.length + Math.min(leftFragment.tupleElements.length, 1);
        const rightFragmentCount = rightFragment.variables.length + Math.min(rightFragment.tupleElements.length, 1);
        // Table-level: one identifier per side; column-level: table.column (2+) like Ref
        if (leftFragmentCount < 1) {
          errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'Invalid left endpoint for Dep', field.callee.leftExpression || field.callee));
        }
        if (rightFragmentCount < 1) {
          errors.push(new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'Invalid right endpoint for Dep', field.callee.rightExpression || field.callee));
        }
      }

      if (field.callee && isBinaryDependency(field.callee) && !isEqualTupleOperands(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.UNEQUAL_FIELDS_BINARY_REF, 'Unequal fields in Dep endpoints', field.callee));
      }

      const args = [...field.args];
      if (last(args) instanceof ListExpressionNode) {
        const errs = this.validateFieldSettings(last(args) as ListExpressionNode);
        errors.push(...errs);
        args.pop();
      } else if (args[0] instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSettings(args[0]));
        args.shift();
      }

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_REF_FIELD, 'A Dep field should only have a single binary dependency', arg)));
      }
    });

    return errors;
  }

  validateFieldSettings (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();
    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'color':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_REF_SETTING, '\'color\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, '\'color\' must be a color literal', attr!));
            }
          });
          break;
        case 'note':
          attrs.forEach((attr) => {
            if (
              !isExpressionAQuotedString(attr.value)
              && !(attr.value instanceof IdentiferStreamNode)
            ) {
              errors.push(new CompileError(CompileErrorCode.INVALID_REF_SETTING_VALUE, '\'note\' must be a string literal', attr));
            }
          });
          break;
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_REF_SETTING, `Unknown dep setting '${name}'`, attr)));
      }
    }
    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.publicSymbolTable, this.symbolFactory);
      return validator.validate().errors;
    });
  }
}
