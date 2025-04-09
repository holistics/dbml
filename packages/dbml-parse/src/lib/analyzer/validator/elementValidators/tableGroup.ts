/* eslint-disable class-methods-use-this */
import _, { forIn } from 'lodash';
import { CompileError, CompileErrorCode } from '../../../errors';
import { registerSchemaStack, aggregateSettingList, generateUnknownSettingErrors } from '../utils';
import SymbolTable from '../../symbol/symbolTable';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { createTableGroupFieldSymbolIndex, createTableGroupSymbolIndex } from '../../symbol/symbolIndex';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import { TableGroupFieldSymbol, TableGroupSymbol } from '../../symbol/symbols';
import { isExpressionAVariableNode } from '../../../parser/utils';
import { ElementKindName, SettingName } from '../../types';
import ElementValidator from './elementValidator';

export default class TableGroupValidator extends ElementValidator {
  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    super(declarationNode, publicSymbolTable, symbolFactory, ElementKindName.TableGroup);
  }

  protected validateContext (): CompileError[] {
    return this.validateTopLevelContext(this.declarationNode);
  }

  protected validateName (nameNode?: SyntaxNode): CompileError[] {
    return this.validateSimpleName(nameNode, this.declarationNode);
  }

  protected validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    return this.validateNoAlias(aliasNode);
  }

  protected registerElement (): CompileError[] {
    const { name } = this.declarationNode;
    this.declarationNode.symbol = this.symbolFactory.create(TableGroupSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments.isOk()) {
      const nameFragments = maybeNameFragments.unwrap();
      const tableGroupName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const tableId = createTableGroupSymbolIndex(tableGroupName);
      if (symbolTable.has(tableId)) {
        return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `TableGroup name '${tableGroupName}' already exists`, name!)];
      }
      symbolTable.set(tableId, this.declarationNode.symbol!);
    }

    return [];
  }

  protected validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Color:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_TABLEGROUP_SETTING));
          errors.push(...this.validateColorSetting(name, attrs, CompileErrorCode.INVALID_TABLEGROUP_SETTING));
          break;

        case SettingName.Note:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_TABLEGROUP_SETTING));
          errors.push(...this.validateStringSetting(name, attrs, CompileErrorCode.INVALID_TABLEGROUP_SETTING));
          break;

        default:
          errors.push(...generateUnknownSettingErrors(name, attrs, CompileErrorCode.INVALID_TABLEGROUP_SETTING));
          break;
      }
    });

    return errors;
  }

  protected validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
        'A TableGroup\'s body must be a block',
        body,
      )];
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      const errors: CompileError[] = [];
      if (field.callee && !destructureComplexVariable(field.callee).isOk()) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TABLEGROUP_FIELD, 'A TableGroup field must be of the form <table> or <schema>.<table>', field.callee));
      }

      this.registerField(field);

      if (field.args.length > 0) {
        errors.push(...field.args.map((arg) => new CompileError(CompileErrorCode.INVALID_TABLEGROUP_FIELD, 'A TableGroup field should only have a single Table name', arg)));
      }

      return errors;
    });
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

  private registerField (field: FunctionApplicationNode): CompileError[] {
    if (field.callee && isExpressionAVariableNode(field.callee)) {
      const tableGroupField = extractVarNameFromPrimaryVariable(field.callee).unwrap();
      const tableGroupFieldId = createTableGroupFieldSymbolIndex(tableGroupField);

      const tableGroupSymbol = this.symbolFactory.create(TableGroupFieldSymbol, { declaration: field });
      field.symbol = tableGroupSymbol;

      const symbolTable = this.declarationNode.symbol!.symbolTable!;
      if (symbolTable.has(tableGroupFieldId)) {
        const symbol = symbolTable.get(tableGroupFieldId);
        return [
          new CompileError(CompileErrorCode.DUPLICATE_TABLEGROUP_FIELD_NAME, `${tableGroupField} already exists in the group`, field),
          new CompileError(CompileErrorCode.DUPLICATE_TABLEGROUP_FIELD_NAME, `${tableGroupField} already exists in the group`, symbol!.declaration!),
        ];
      }
      symbolTable.set(tableGroupFieldId, tableGroupSymbol);
    }
    return [];
  }
}
