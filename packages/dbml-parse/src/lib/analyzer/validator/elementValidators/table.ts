import _, { last } from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  ListExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import {
  aggregateSettingList,
  SettingName,
  isSimpleName,
  isUnaryRelationship,
  isValidAlias,
  isValidColor,
  isValidColumnType,
  isValidDefaultValue,
  isValidName,
  isVoid,
  pickValidator,
  registerSchemaStack,
  validateColumnSettings,
} from '../utils';
import { ElementValidator } from '../types';
import { ColumnSymbol, TableSymbol } from '../../symbol/symbols';
import { createColumnSymbolIndex, createTableSymbolIndex } from '../../symbol/symbolIndex';
import {
  isExpressionAQuotedString,
  isExpressionAVariableNode,
  isExpressionAnIdentifierNode,
} from '../../../parser/utils';
import { SyntaxToken } from '../../../lexer/tokens';
import SymbolTable from '../../symbol/symbolTable';

function isAliasSameAsName (alias: string, nameFragments: string[]): boolean {
  return nameFragments.length === 1 && alias === nameFragments[0];
}

export default class TableValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken};
  private symbolFactory: SymbolFactory;
  private publicSymbolTable: SymbolTable;

  constructor (
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
    publicSymbolTable: SymbolTable,
    symbolFactory: SymbolFactory,
  ) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.publicSymbolTable = publicSymbolTable;
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
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, 'Table must appear top-level', this.declarationNode)];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A Table must have a name', this.declarationNode)];
    }
    if (nameNode instanceof ArrayNode) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid array as Table name, maybe you forget to add a space between the name and the setting list?', nameNode)];
    }
    if (!isValidName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Table name must be of the form <table> or <schema>.<table>', nameNode)];
    }

    return [];
  }

  /* eslint-disable-next-line class-methods-use-this */
  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    if (!isValidAlias(aliasNode)) {
      return [new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contains alphanumeric and underscore unless surrounded by double quotes', aliasNode)];
    }

    return [];
  }

  private validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    for (const name in settingMap) {
      const attrs = settingMap[name];
      switch (name) {
        case 'headercolor':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'headercolor\' can only appear once', attr)))
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING, '\'headercolor\' must be a color literal', attr.value || attr.name!));
            }
          });
          break;
        case 'note':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'note\' can only appear once', attr)))
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING, '\'note\' must be a string literal', attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.INVALID_TABLE_SETTING, `Unknown \'${name}\' setting`, attr)))
      }
    }
    return errors;
  }

  registerElement(): CompileError[] {
    const errors: CompileError[] = [];
    this.declarationNode.symbol = this.symbolFactory.create(TableSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    
    const { name, alias } = this.declarationNode;

    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments.isOk()) {
      const nameFragments = [...maybeNameFragments.unwrap()];
      const tableName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const tableId = createTableSymbolIndex(tableName);
      if (symbolTable.has(tableId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${tableName}' already exists in schema '${nameFragments.join('.') || 'public'}'`, name!))
      }
      symbolTable.set(tableId, this.declarationNode.symbol!);
    }
  
    if (
        alias && isSimpleName(alias) &&
        !isAliasSameAsName(alias.expression.variable!.value, maybeNameFragments.unwrap_or([]))
    ) {
      const aliasName = extractVarNameFromPrimaryVariable(alias as any).unwrap();
      const aliasId = createTableSymbolIndex(aliasName);
      if (this.publicSymbolTable.has(aliasId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${aliasName}' already exists`, name!))
      }
      this.publicSymbolTable.set(aliasId, this.declarationNode.symbol!)
    }

    return errors;
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Table\'s body must be a block', body)];
    }

    const [fieldsAndTableFragments, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFieldsAndTableFragments(fieldsAndTableFragments as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFieldsAndTableFragments (fieldsAndTableFragments: FunctionApplicationNode[]): CompileError[] {
    if (fieldsAndTableFragments.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_TABLE, 'A Table must have at least one column', this.declarationNode)];
    }

    return fieldsAndTableFragments.flatMap((fieldOrTableFragment) => {
      return fieldOrTableFragment.callee instanceof PrefixExpressionNode
        ? this.validateTableFragment(fieldOrTableFragment)
        : this.validateField(fieldOrTableFragment);
    });
  }

  /* eslint-disable-next-line class-methods-use-this */
  validateTableFragment (tableFragment: FunctionApplicationNode): CompileError[] {
    if (!tableFragment.callee) return [];

    const errors: CompileError[] = [];
    const callee = tableFragment.callee as PrefixExpressionNode;

    if (!callee.op) errors.push(new CompileError(CompileErrorCode.MISSING_TABLE_FRAGMENT_SYMBOL, 'Missing symbol for table fragment', callee));
    else if (callee.op.value !== '+') errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_FRAGMENT_SYMBOL, 'Invalid symbol for table fragment', callee.op));

    if (!isExpressionAVariableNode(callee.expression)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A table fragment name must be an identifier or a quoted identifier', callee));
    }

    return errors;
  }

  validateField (field: FunctionApplicationNode): CompileError[] {
    if (!field.callee) return [];

    const errors: CompileError[] = [];

    if (field.args.length === 0) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!));
    }

    if (!isExpressionAVariableNode(field.callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee));
    }

    if (field.args[0] && !isValidColumnType(field.args[0])) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0]));
    }

    const remains = field.args.slice(1);

    errors.push(...this.validateFieldSetting(remains));
    errors.push(...this.registerField(field));

    return errors;
  }

  registerField (field: FunctionApplicationNode): CompileError[] {
    if (field.callee && isExpressionAVariableNode(field.callee)) {
      const columnName = extractVarNameFromPrimaryVariable(field.callee).unwrap();
      const columnId = createColumnSymbolIndex(columnName);

      const columnSymbol = this.symbolFactory.create(ColumnSymbol, { declaration: field });
      field.symbol = columnSymbol;

      const symbolTable = this.declarationNode.symbol!.symbolTable!;
      if (symbolTable.has(columnId)) {
        const symbol = symbolTable.get(columnId)!;
        return [
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, field),
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, symbol.declaration!),
        ];
      }
      symbolTable.set(columnId, columnSymbol);
    }
    return [];
  }

  // This is needed to support legacy inline settings
  // eslint-disable-next-line class-methods-use-this
  validateFieldSetting (parts: (ExpressionNode | PrimaryExpressionNode & { expression: VariableNode })[]): CompileError[] {
    if (parts.length === 0) return [];

    const remains = parts.slice(0, -1) as (PrimaryExpressionNode & { expression: VariableNode })[];

    const lastPart = last(parts);
    const isLastPartListExpression = lastPart instanceof ListExpressionNode;

    if (
      !remains.every(isExpressionAnIdentifierNode)
      || !(
        isExpressionAnIdentifierNode(lastPart)
        || isLastPartListExpression
      )
    ) {
      return [...parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part))];
    }

    const settingList = isLastPartListExpression
      ? lastPart as ListExpressionNode
      : undefined;

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap: Record<SettingName | string, (AttributeNode | PrimaryExpressionNode)[]> = aggReport.getValue();

    remains.forEach((part) => {
      const name = extractVarNameFromPrimaryVariable(part).unwrap_or('').toLowerCase();

      if (name !== SettingName.PK && name !== SettingName.Unique) {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
        return;
      }

      if (settingMap[name] === undefined) settingMap[name] = [part];
      else settingMap[name]!.push(part);
    });

    errors.push(...validateColumnSettings(settingMap));

    return errors;
  }

  private validateSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.publicSymbolTable, this.symbolFactory);
      return validator.validate();
    });

    const notes = subs.filter((sub) => sub.type?.value.toLowerCase() === 'note');
    if (notes.length > 1) {
      errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    }

    return errors;
  }
}
