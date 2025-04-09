/* eslint-disable class-methods-use-this */
import _, { forIn } from 'lodash';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  pickValidator, registerSchemaStack, aggregateSettingList, isValidColumnType,
} from '../utils';
import { ElementValidator } from '../types';
import SymbolTable from '../../symbol/symbolTable';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { createColumnSymbolIndex, createTableFragmentSymbolIndex } from '../../symbol/symbolIndex';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import { ColumnSymbol, TableFragmentSymbol } from '../../symbol/symbols';
import { isExpressionAVariableNode } from '../../../parser/utils';
import CommonValidator from '../commonValidator';
import { ElementKindName, SettingName } from '../../types';

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
    return CommonValidator.validateTopLevelContext(this.declarationNode, ElementKindName.TableFragment);
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    return CommonValidator.validateSimpleName(nameNode, this.declarationNode, ElementKindName.TableFragment);
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return CommonValidator.validateNoAlias(aliasNode, ElementKindName.TableFragment);
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

    forIn(settingMap, (attrs, name) => {
      errors.push(...CommonValidator.validateUniqueSetting(
        name,
        attrs,
        [SettingName.HeaderColor, SettingName.Note],
        CompileErrorCode.DUPLICATE_TABLE_FRAGMENT_SETTING,
      ));

      switch (name) {
        case SettingName.HeaderColor:
          errors.push(...CommonValidator.validateColorSetting(name, attrs, CompileErrorCode.INVALID_TABLE_FRAGMENT_SETTING));
          break;

        case SettingName.Note:
          errors.push(...CommonValidator.validateNoteSetting(attrs, CompileErrorCode.INVALID_TABLE_FRAGMENT_SETTING));
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

      errors.push(...CommonValidator.validateColumnSettings(remains));
      errors.push(...this.registerField(field));

      return errors;
    });
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) return [];

      const Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.publicSymbolTable, this.symbolFactory);
      return validator.validate();
    });

    errors.push(...CommonValidator.validateNotesAsSubElements(subs));

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
