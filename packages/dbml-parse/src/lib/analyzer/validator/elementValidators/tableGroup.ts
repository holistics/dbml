/* eslint-disable class-methods-use-this */
import _ from 'lodash';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  isSimpleName, pickValidator, registerSchemaStack, aggregateSettingList, isValidColor
} from '../utils';
import { ElementValidator } from '../types';
import SymbolTable from '../../symbol/symbolTable';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { createTableGroupFieldSymbolIndex, createTableGroupSymbolIndex } from '../../symbol/symbolIndex';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import { TableGroupFieldSymbol, TableGroupSymbol } from '../../symbol/symbols';
import { isExpressionAVariableNode, isExpressionAQuotedString } from '../../../parser/utils';

export default class TableGroupValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate(): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.registerElement(),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext(): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(
        CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
        'TableGroup must appear top-level',
        this.declarationNode,
      )];
    }
    return [];
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(
        CompileErrorCode.NAME_NOT_FOUND,
        'A TableGroup must have a name',
        this.declarationNode,
      )];
    }
    if (!isSimpleName(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_NAME,
        'A TableGroup name must be a single identifier',
        nameNode,
      )];
    }
    return [];
  }

  private validateAlias(aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_ALIAS,
        'A TableGroup shouldn\'t have an alias',
        aliasNode,
      )];
    }

    return [];
  }

  registerElement(): CompileError[] {
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

  private validateSettingList(settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    _.forIn(settingMap, (attrs, name) => {
      switch (name) {
        case 'color':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(
              CompileErrorCode.DUPLICATE_TABLE_SETTING,
              '\'color\' can only appear once',
              attr,
            )));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_TABLE_SETTING,
                '\'color\' must be a color literal',
                attr.value || attr.name!,
              ));
            }
          });
          break;
        case 'note':
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(
              CompileErrorCode.DUPLICATE_TABLE_SETTING,
              '\'note\' can only appear once',
              attr,
            )));
          }
          attrs
            .filter((attr) => !isExpressionAQuotedString(attr.value))
            .forEach((attr) => {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_TABLE_SETTING,
                '\'note\' must be a string literal',
                attr.value || attr.name!,
              ));
            });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(
            CompileErrorCode.INVALID_TABLE_SETTING,
            `Unknown '${name}' setting`,
            attr,
          )));
          break;
      }
    });
    return errors;
  }

  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
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

  validateFields(fields: FunctionApplicationNode[]): CompileError[] {
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
    if (notes.length > 1) errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    return errors;
  }

  registerField(field: FunctionApplicationNode): CompileError[] {
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
