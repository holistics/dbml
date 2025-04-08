/* eslint-disable class-methods-use-this */
import _, { last } from 'lodash';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  isSimpleName, pickValidator, registerSchemaStack, aggregateSettingList, isValidColor,
  isValidColumnType,
  SettingName,
  validateColumnSettings,
} from '../utils';
import { ElementValidator } from '../types';
import SymbolTable from '../../symbol/symbolTable';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  AttributeNode, BlockExpressionNode, ElementDeclarationNode, ExpressionNode,
  FunctionApplicationNode, ListExpressionNode, PrimaryExpressionNode, SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { createColumnSymbolIndex, createTableFragmentSymbolIndex } from '../../symbol/symbolIndex';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import { ColumnSymbol, TableFragmentSymbol } from '../../symbol/symbols';
import { isExpressionAVariableNode, isExpressionAQuotedString, isExpressionAnIdentifierNode } from '../../../parser/utils';

export default class TableFragmentValidator implements ElementValidator {
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
      return [new CompileError(
        CompileErrorCode.INVALID_TABLE_FRAGMENT_CONTEXT,
        'TableFragment must appear top-level',
        this.declarationNode,
      )];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(
        CompileErrorCode.NAME_NOT_FOUND,
        'A TableFragment must have a name',
        this.declarationNode,
      )];
    }
    if (!isSimpleName(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_NAME,
        'A TableFragment name must be a single identifier',
        nameNode,
      )];
    }
    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_ALIAS,
        'A TableFragment shouldn\'t have an alias',
        aliasNode,
      )];
    }

    return [];
  }

  registerElement (): CompileError[] {
    const { name } = this.declarationNode;
    this.declarationNode.symbol = this.symbolFactory.create(TableFragmentSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments.isOk()) {
      const nameFragments = maybeNameFragments.unwrap();
      const tableFragmentName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const tableId = createTableFragmentSymbolIndex(tableFragmentName);
      if (symbolTable.has(tableId)) {
        return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `TableFragment name '${tableFragmentName}' already exists`, name!)];
      }
      symbolTable.set(tableId, this.declarationNode.symbol!);
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    _.forIn(settingMap, (attrs, name) => {
      switch (name) {
        case 'headercolor':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(
              CompileErrorCode.DUPLICATE_TABLE_FRAGMENT_SETTING,
              '\'headercolor\' can only appear once',
              attr,
            )));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_TABLE_FRAGMENT_SETTING,
                '\'headercolor\' must be a color literal',
                attr.value || attr.name!,
              ));
            }
          });
          break;
        case 'note':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(
              CompileErrorCode.DUPLICATE_TABLE_FRAGMENT_SETTING,
              '\'note\' can only appear once',
              attr,
            )));
          }
          attrs
            .filter((attr) => !isExpressionAQuotedString(attr.value))
            .forEach((attr) => {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_TABLE_FRAGMENT_SETTING,
                '\'note\' must be a string literal',
                attr.value || attr.name!,
              ));
            });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(
            CompileErrorCode.INVALID_TABLE_FRAGMENT_SETTING,
            `Unknown '${name}' setting`,
            attr,
          )));
          break;
      }
    });
    return errors;
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
        'A TableFragment\'s body must be a block',
        body,
      )];
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      const errors: CompileError[] = [];

      if (field.args.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!));
      }

      if (!isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee!));
      }

      if (field.args[0] && !isValidColumnType(field.args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0]));
      }

      const remains = field.args.slice(1);

      errors.push(...this.validateFieldSetting(remains));
      errors.push(...this.registerField(field));

      return errors;
    });
  }

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
      return parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part));
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

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
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
    if (notes.length > 1) errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
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
        const symbol = symbolTable.get(columnId);
        return [
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, field),
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, symbol!.declaration!),
        ];
      }
      symbolTable.set(columnId, columnSymbol);
    }
    return [];
  }
}
