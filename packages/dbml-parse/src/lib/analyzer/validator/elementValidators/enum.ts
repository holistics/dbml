import { last, partition } from 'lodash-es';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '../../../parser/nodes';
import { isExpressionAQuotedString, isExpressionAVariableNode } from '../../../parser/utils';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementValidator } from '../types';
import {
  aggregateSettingList, isValidName, pickValidator, registerSchemaStack,
} from '../utils';
import { createEnumFieldSymbolIndex, createEnumSymbolIndex } from '../../symbol/symbolIndex';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import SymbolTable from '../../symbol/symbolTable';
import { EnumFieldSymbol, EnumSymbol } from '../../symbol/symbols';

export default class EnumValidator implements ElementValidator {
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
      ...this.registerElement(),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_PROJECT_CONTEXT, 'An Enum can only appear top-level', this.declarationNode)];
    }

    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'An Enum must have a name', this.declarationNode)];
    }
    if (!isValidName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'An Enum name must be of the form <enum> or <schema>.<enum>', nameNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'An Enum shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  registerElement (): CompileError[] {
    const errors: CompileError[] = [];
    this.declarationNode.symbol = this.symbolFactory.create(EnumSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    const { name } = this.declarationNode;

    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments.isOk()) {
      const nameFragments = maybeNameFragments.unwrap();
      const enumName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const enumId = createEnumSymbolIndex(enumName);
      if (symbolTable.has(enumId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Enum name ${enumName} already exists in schema '${nameFragments.join('.') || 'public'}'`, name!));
      }
      symbolTable.set(enumId, this.declarationNode.symbol!);
    }

    return errors;
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'An Enum shouldn\'t have a setting list', settingList)];
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
      return [new CompileError(CompileErrorCode.EMPTY_ENUM, 'An Enum must have at least one element', this.declarationNode)];
    }

    return fields.flatMap((field) => {
      const errors: CompileError[] = [];

      if (field.callee && !isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT_NAME, 'An enum field must be an identifier or a quoted identifier', field.callee));
      }

      const args = [...field.args];
      if (last(args) instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSettings(last(args) as ListExpressionNode));
        args.pop();
      } else if (args[0] instanceof ListExpressionNode) {
        errors.push(...this.validateFieldSettings(args[0]));
        args.shift();
      }

      if (args.length > 0) {
        errors.push(...args.map((arg) => new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT, 'An Enum must have only a field and optionally a setting list', arg)));
      }

      errors.push(...this.registerField(field));

      return errors;
    });
  }

  validateFieldSettings (settings: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settings);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'note':
          if (attrs.length > 1) {
            attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING, '\'note\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING, '\'note\' must be a string', attr));
            }
          });
          break;
        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_ENUM_ELEMENT_SETTING, `Unknown enum field setting '${name}'`, attr)));
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
      return validator.validate();
    });
  }

  registerField (field: FunctionApplicationNode): CompileError[] {
    if (field.callee && isExpressionAVariableNode(field.callee)) {
      const enumFieldName = extractVarNameFromPrimaryVariable(field.callee).unwrap();
      const enumFieldId = createEnumFieldSymbolIndex(enumFieldName);

      const enumSymbol = this.symbolFactory.create(EnumFieldSymbol, { declaration: field });
      field.symbol = enumSymbol;

      const symbolTable = this.declarationNode.symbol!.symbolTable!;
      if (symbolTable.has(enumFieldId)) {
        const symbol = symbolTable.get(enumFieldId);
        return [
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate enum field ${enumFieldName}`, field),
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate enum field ${enumFieldName}`, symbol!.declaration!),
        ];
      }
      symbolTable.set(enumFieldId, enumSymbol);
    }
    return [];
  }
}
