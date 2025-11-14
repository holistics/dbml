import { partition, forIn, last } from 'lodash-es';
import SymbolFactory from '@analyzer/symbol/factory';
import { CompileError, CompileErrorCode } from '@lib/errors';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '@parser/nodes';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '@analyzer/utils';
import {
  aggregateSettingList,
  isSimpleName,
  isUnaryRelationship,
  isValidColor,
  isValidColumnType,
  isValidDefaultValue,
  isVoid,
  registerSchemaStack,
  pickValidator,
} from '@analyzer/validator/utils';
import { ElementValidator } from '@analyzer/validator/types';
import { ColumnSymbol, TablePartialSymbol } from '@analyzer/symbol/symbols';
import { createColumnSymbolIndex, createTablePartialSymbolIndex } from '@analyzer/symbol/symbolIndex';
import {
  isExpressionAQuotedString,
  isExpressionAVariableNode,
  isExpressionAnIdentifierNode,
} from '@parser/utils';
import { SyntaxToken } from '@lexer/tokens';
import SymbolTable from '@analyzer/symbol/symbolTable';
import { ElementKind, SettingName } from '@analyzer/types';

export default class TablePartialValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

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
      return [new CompileError(
        CompileErrorCode.INVALID_TABLE_PARTIAL_CONTEXT,
        'TablePartial must appear top-level',
        this.declarationNode,
      )];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(
        CompileErrorCode.NAME_NOT_FOUND,
        'A TablePartial must have a name',
        this.declarationNode,
      )];
    }
    if (!isSimpleName(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_NAME,
        'A TablePartial name must be an identifier or a quoted identifer',
        nameNode,
      )];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(
        CompileErrorCode.UNEXPECTED_ALIAS,
        'A TablePartial shouldn\'t have an alias',
        aliasNode,
      )];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap = aggReport.getValue();

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.HeaderColor:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_SETTING_VALUE, `'${name}' must be a color literal`, attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_SETTING_VALUE, `'${name}' must be a string literal`, attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_PARTIAL_SETTING, `Unknown '${name}' setting`, attr)));
      }
    });
    return errors;
  }

  registerElement (): CompileError[] {
    const { name } = this.declarationNode;
    this.declarationNode.symbol = this.symbolFactory.create(TablePartialSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    const maybeNamePartials = destructureComplexVariable(name);
    if (!maybeNamePartials.isOk()) return [];

    const namePartials = maybeNamePartials.unwrap();
    const tablePartialName = namePartials.pop()!;
    const symbolTable = registerSchemaStack(namePartials, this.publicSymbolTable, this.symbolFactory);
    const tablePartialId = createTablePartialSymbolIndex(tablePartialName);
    if (symbolTable.has(tablePartialId)) {
      return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `TablePartial name '${tablePartialName}' already exists`, name!)];
    }
    symbolTable.set(tablePartialId, this.declarationNode.symbol!);

    return [];
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A TablePartial\'s body must be a block', body)];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
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
      errors.push(
        ...this.validateFieldSetting(remains),
        ...this.registerField(field),
      );

      return errors;
    });
  }

  registerField (field: FunctionApplicationNode): CompileError[] {
    if (!field.callee || !isExpressionAVariableNode(field.callee)) return [];

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
    return [];
  }

  // This is needed to support legacy inline settings
  validateFieldSetting (parts: ExpressionNode[]): CompileError[] {
    const lastPart = last(parts);
    if (
      !parts.slice(0, -1).every(isExpressionAnIdentifierNode)
      || !(isExpressionAnIdentifierNode(lastPart) || lastPart instanceof ListExpressionNode)
    ) {
      return [...parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part))];
    }

    if (parts.length === 0) return [];

    let settingList: ListExpressionNode | undefined;
    if (last(parts) instanceof ListExpressionNode) {
      settingList = parts.pop() as ListExpressionNode;
    }

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap: {
      [index: string]: AttributeNode[];
    } & {
      pk?: (AttributeNode | PrimaryExpressionNode)[];
      unique?: (AttributeNode | PrimaryExpressionNode)[];
    } = aggReport.getValue();

    parts.forEach((part) => {
      const name = extractVarNameFromPrimaryVariable(part as any).unwrap_or('').toLowerCase();
      if (name !== SettingName.PK && name !== SettingName.Unique) {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
        return;
      }
      if (settingMap[name] === undefined) {
        settingMap[name] = [part as PrimaryExpressionNode];
      } else {
        settingMap[name]!.push(part as PrimaryExpressionNode);
      }
    });

    const pkAttrs = settingMap[SettingName.PK] || [];
    const pkeyAttrs = settingMap[SettingName.PrimaryKey] || [];
    if (pkAttrs.length >= 1 && pkeyAttrs.length >= 1) {
      errors.push(...[...pkAttrs, ...pkeyAttrs].map((attr) => new CompileError(
        CompileErrorCode.DUPLICATE_COLUMN_SETTING,
        'Either one of \'primary key\' and \'pk\' can appear',
        attr,
      )));
    }

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must be a quoted string`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.Ref:
          attrs.forEach((attr) => {
            if (!isUnaryRelationship(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must be a valid unary relationship`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.PrimaryKey:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.PK:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.NotNull: {
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          const nullAttrs = settingMap[SettingName.Null] || [];
          if (attrs.length >= 1 && nullAttrs.length >= 1) {
            errors.push(...[...attrs, ...nullAttrs].map((attr) => new CompileError(
              CompileErrorCode.CONFLICTING_SETTING,
              '\'not null\' and \'null\' can not be set at the same time',
              attr,
            )));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attr.value || attr.name!));
            }
          });
          break;
        }

        case SettingName.Null:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.Unique:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.Increment:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${name}' must not have a value`, attr.value || attr.name!));
            }
          });
          break;

        case SettingName.Default:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidDefaultValue(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                `'${name}' must be a string literal, number literal, function expression, true, false or null`,
                attr.value || attr.name!,
              ));
            }
          });
          break;

        case SettingName.Check:
          attrs.forEach((attr) => {
            if (!(attr.value instanceof FunctionExpressionNode)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attr.value || attr.name!));
            }
          });
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr)));
      }
    });
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

    const notes = subs.filter((sub) => sub.type?.value.toLowerCase() === ElementKind.Note);
    if (notes.length > 1) {
      errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note)));
    }

    return errors;
  }
}
