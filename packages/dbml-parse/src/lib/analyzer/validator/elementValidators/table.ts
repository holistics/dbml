/* eslint-disable class-methods-use-this */
import _, { forIn } from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  ArrayNode,
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
  generateUnknownSettingErrors,
  isSimpleName,
  isValidAlias,
  isValidColumnType,
  isValidName,
  registerSchemaStack,
} from '../utils';
import { ColumnSymbol, TableFragmentAsFieldSymbol, TableSymbol } from '../../symbol/symbols';
import { createColumnSymbolIndex, createTableFragmentSymbolIndex, createTableSymbolIndex } from '../../symbol/symbolIndex';
import { isExpressionAVariableNode } from '../../../parser/utils';
import { SyntaxToken } from '../../../lexer/tokens';
import SymbolTable from '../../symbol/symbolTable';
import { ElementKindName, SettingName } from '../../types';
import ElementValidator from './elementValidator';

function isAliasSameAsName (alias: string, nameFragments: string[]): boolean {
  return nameFragments.length === 1 && alias === nameFragments[0];
}

export default class TableValidator extends ElementValidator {
  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    super(declarationNode, publicSymbolTable, symbolFactory, ElementKindName.Table);
  }

  protected validateContext (): CompileError[] {
    return this.validateTopLevelContext(this.declarationNode);
  }

  protected validateName (nameNode?: SyntaxNode): CompileError[] {
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

  protected validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    if (!isValidAlias(aliasNode)) {
      return [new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contains alphanumeric and underscore unless surrounded by double quotes', aliasNode)];
    }

    return [];
  }

  protected validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.HeaderColor:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_TABLE_SETTING));
          errors.push(...this.validateColorSetting(name, attrs, CompileErrorCode.INVALID_TABLE_SETTING));
          break;

        case SettingName.Note:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_TABLE_SETTING));
          errors.push(...this.validateStringSetting(name, attrs, CompileErrorCode.INVALID_TABLE_SETTING));
          break;

        default:
          errors.push(...generateUnknownSettingErrors(name, attrs, CompileErrorCode.INVALID_TABLE_SETTING));
      }
    });

    return errors;
  }

  protected registerElement (): CompileError[] {
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
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${tableName}' already exists in schema '${nameFragments.join('.') || 'public'}'`, name!));
      }
      symbolTable.set(tableId, this.declarationNode.symbol!);
    }

    if (
      alias && isSimpleName(alias)
      && !isAliasSameAsName(alias.expression.variable!.value, maybeNameFragments.unwrap_or([]))
    ) {
      const aliasName = extractVarNameFromPrimaryVariable(alias).unwrap();
      const aliasId = createTableSymbolIndex(aliasName);
      if (this.publicSymbolTable.has(aliasId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${aliasName}' already exists`, name!));
      }
      this.publicSymbolTable.set(aliasId, this.declarationNode.symbol!);
    }

    return errors;
  }

  protected validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Table\'s body must be a block', body)];
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    if (fields.length === 0) {
      return [new CompileError(CompileErrorCode.EMPTY_TABLE, 'A Table must have at least one column', this.declarationNode)];
    }

    return fields.flatMap((field) => {
      return field.callee instanceof PrefixExpressionNode
        ? this.validateTableFragment(field)
        : this.validateColumn(field);
    });
  }

  private validateTableFragment (tableFragment: FunctionApplicationNode): CompileError[] {
    if (!tableFragment.callee) return [];

    const errors: CompileError[] = [];
    const callee = tableFragment.callee as PrefixExpressionNode;

    if (!callee.op) errors.push(new CompileError(CompileErrorCode.MISSING_TABLE_FRAGMENT_SYMBOL, 'Missing symbol for table fragment', callee));
    else if (callee.op.value !== '+') errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_FRAGMENT_SYMBOL, 'Invalid symbol for table fragment', callee.op));

    if (!isExpressionAVariableNode(callee.expression)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A table fragment name must be an identifier or a quoted identifier', callee));
    }

    if (tableFragment.args.length > 0) errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_FRAGMENT_FIELD, 'A table fragment should not have arguments', tableFragment));

    errors.push(...this.registerTableFragment(tableFragment));

    return errors;
  }

  private registerTableFragment (tableFragment: FunctionApplicationNode): CompileError[] {
    const callee = tableFragment.callee as PrefixExpressionNode;
    if (callee && isExpressionAVariableNode(callee.expression)) {
      const tableFragmentName = extractVarNameFromPrimaryVariable(callee.expression).unwrap();
      const tableFragmentId = createTableFragmentSymbolIndex(tableFragmentName);

      const tableFragmentSymbol = this.symbolFactory.create(TableFragmentAsFieldSymbol, { declaration: tableFragment });
      tableFragment.symbol = tableFragmentSymbol;

      const symbolTable = this.declarationNode.symbol!.symbolTable!;
      if (symbolTable.has(tableFragmentId)) {
        const symbol = symbolTable.get(tableFragmentId)!;
        return [
          new CompileError(CompileErrorCode.DUPLICATE_TABLE_FRAGMENT_NAME, `Duplicate tableFragment ${tableFragmentName}`, tableFragment),
          new CompileError(CompileErrorCode.DUPLICATE_TABLE_FRAGMENT_NAME, `Duplicate tableFragment ${tableFragmentName}`, symbol.declaration!),
        ];
      }
      symbolTable.set(tableFragmentId, tableFragmentSymbol);
    }
    return [];
  }

  private validateColumn (column: FunctionApplicationNode): CompileError[] {
    if (!column.callee) return [];

    const errors: CompileError[] = [];

    if (column.args.length === 0) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', column.callee!));
    }

    if (!isExpressionAVariableNode(column.callee)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', column.callee));
    }

    if (column.args[0] && !isValidColumnType(column.args[0])) {
      errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', column.args[0]));
    }

    const remains = column.args.slice(1);

    errors.push(...this.validateColumnSetting(remains));
    errors.push(...this.registerColumn(column));

    return errors;
  }

  private registerColumn (column: FunctionApplicationNode): CompileError[] {
    if (column.callee && isExpressionAVariableNode(column.callee)) {
      const columnName = extractVarNameFromPrimaryVariable(column.callee).unwrap();
      const columnId = createColumnSymbolIndex(columnName);

      const columnSymbol = this.symbolFactory.create(ColumnSymbol, { declaration: column });
      column.symbol = columnSymbol;

      const symbolTable = this.declarationNode.symbol!.symbolTable!;
      if (symbolTable.has(columnId)) {
        const symbol = symbolTable.get(columnId)!;
        return [
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, column),
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, symbol.declaration!),
        ];
      }
      symbolTable.set(columnId, columnSymbol);
    }
    return [];
  }

  private validateColumnSetting (parts: (ExpressionNode | (PrimaryExpressionNode & { expression: VariableNode }))[]): CompileError[] {
    return this.validateColumnSettings(parts);
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return [
      ...this.validateSubElementsWithOwnedValidators(
        subs,
        this.declarationNode,
        this.publicSymbolTable,
        this.symbolFactory,
      ),
      ...this.validateNotesAsSubElements(subs),
    ];
  }
}
