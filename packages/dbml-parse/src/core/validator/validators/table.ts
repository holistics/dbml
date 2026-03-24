import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { last, forIn, partition } from 'lodash-es';
import SymbolFactory from '@/core/validator/symbol/factory';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '@/core/parser/nodes';
import { NodeToSymbolMap } from '@/core/types';
import { destructureComplexVariable, extractVariableFromExpression, extractVarNameFromPrimaryVariable } from '@/core/utils';
import {
  aggregateSettingList,
  isSimpleName,
  isUnaryRelationship,
  isValidAlias,
  isValidColor,
  isValidColumnType,
  isValidDefaultValue,
  isValidName,
  isValidPartialInjection,
  isVoid,
  pickElementValidator,
  registerSchemaStack,
} from '@/core/validator/utils';
import { ElementValidator, ElementValidatorArgs, ElementValidatorResult } from '@/core/validator/types';
import { ColumnSymbol, PartialInjectionSymbol, TableSymbol } from '@/core/validator/symbol/symbols';
import { createColumnSymbolIndex, createPartialInjectionSymbolIndex, createTableSymbolIndex } from '@/core/validator/symbol/symbolIndex';
import {
  isExpressionAQuotedString,
  isExpressionAVariableNode,
  isExpressionAnIdentifierNode,
} from '@/core/parser/utils';
import { SyntaxToken } from '@/core/lexer/tokens';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { SettingName } from '@/core/types';

export default class TableValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private symbolFactory: SymbolFactory;
  private publicSymbolTable: SymbolTable;
  private nodeToSymbol: NodeToSymbolMap;

  constructor (
    { declarationNode, publicSymbolTable, nodeToSymbol }: ElementValidatorArgs,
    symbolFactory: SymbolFactory,
  ) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.publicSymbolTable = publicSymbolTable;
    this.nodeToSymbol = nodeToSymbol;
  }

  validate (): ElementValidatorResult {
    return {
      errors: [
        ...this.validateContext(),
        ...this.validateName(this.declarationNode.name),
        ...this.validateAlias(this.declarationNode.alias),
        ...this.validateSettingList(this.declarationNode.attributeList),
        ...this.registerElement(),
        ...this.validateBody(this.declarationNode.body),
      ],
    };
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, 'Table must appear top-level', this.declarationNode, this.symbolFactory.filepath)];
    }
    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A Table must have a name', this.declarationNode, this.symbolFactory.filepath)];
    }
    if (nameNode instanceof ArrayNode) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid array as Table name, maybe you forget to add a space between the name and the setting list?', nameNode, this.symbolFactory.filepath)];
    }
    if (!isValidName(nameNode)) {
      return [new CompileError(CompileErrorCode.INVALID_NAME, 'A Table name must be of the form <table> or <schema>.<table>', nameNode, this.symbolFactory.filepath)];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    if (!isValidAlias(aliasNode)) {
      return [new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contains alphanumeric and underscore unless surrounded by double quotes', aliasNode, this.symbolFactory.filepath)];
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
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'headercolor\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'headercolor\' must be a color literal', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'note\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'note\' must be a string literal', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_SETTING, `Unknown '${name}' setting`, attr, this.symbolFactory.filepath)));
      }
    });
    return errors;
  }

  registerElement (): CompileError[] {
    const errors: CompileError[] = [];
    const tableSymbol = this.symbolFactory.create(TableSymbol, { declaration: this.declarationNode, symbolTable: new SymbolTable() });
    this.nodeToSymbol.set(this.declarationNode, tableSymbol);

    const { name, alias } = this.declarationNode;

    const maybeNameFragments = destructureComplexVariable(name);
    if (maybeNameFragments.isOk()) {
      const nameFragments = [...maybeNameFragments.unwrap()];
      const tableName = nameFragments.pop()!;
      const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
      const tableId = createTableSymbolIndex(tableName);
      if (symbolTable.has(tableId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${tableName}' already exists in schema '${nameFragments.join('.') || DEFAULT_SCHEMA_NAME}'`, name!, this.symbolFactory.filepath));
      }
      symbolTable.set(tableId, tableSymbol);
    }

    if (
      alias && isSimpleName(alias)

      && !isAliasSameAsName(alias.expression.variable!.value, maybeNameFragments.unwrap_or([]))
    ) {
      const aliasName = extractVarNameFromPrimaryVariable(alias as any).unwrap();
      const aliasId = createTableSymbolIndex(aliasName);
      if (this.publicSymbolTable.has(aliasId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${aliasName}' already exists`, name!, this.symbolFactory.filepath));
      }
      this.publicSymbolTable.set(aliasId, tableSymbol);
    }

    return errors;
  }

  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Table\'s body must be a block', body, this.symbolFactory.filepath)];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    const validateColumn = (field: FunctionApplicationNode) => {
      const errors: CompileError[] = [];
      if (!field.callee) {
        return [];
      }
      if (field.args.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!, this.symbolFactory.filepath));
      }

      if (!isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee, this.symbolFactory.filepath));
      }

      if (field.args[0] && !isValidColumnType(field.args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0], this.symbolFactory.filepath));
      }

      const remains = field.args.slice(1);
      errors.push(...this.validateFieldSetting(remains));

      errors.push(...this.registerField(field));

      return errors;
    };
    const validatePartialInjection = (field: FunctionApplicationNode) => {
      const errors: CompileError[] = [];
      if (!field.callee) {
        return [];
      }
      if (!isValidPartialInjection(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_INJECTION, 'A partial injection should be of the form ~<table-partial>', field.callee, this.symbolFactory.filepath));
      } else {
        const injectedTablePartialName = extractVariableFromExpression(field.callee.expression).unwrap_or('');
        const partialInjectionSymbol = this.symbolFactory.create(PartialInjectionSymbol, { symbolTable: new SymbolTable(), declaration: field });
        const partialInjectionSymbolId = createPartialInjectionSymbolIndex(injectedTablePartialName);
        const symbolTable = (this.nodeToSymbol.get(this.declarationNode) as TableSymbol)!.symbolTable!;
        if (symbolTable.has(partialInjectionSymbolId)) {
          const symbol = symbolTable.get(partialInjectionSymbolId);
          return [
            new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_INJECTION_NAME, `Duplicate table partial injection '${injectedTablePartialName}'`, field, this.symbolFactory.filepath),
            new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_INJECTION_NAME, `Duplicate table partial injection '${injectedTablePartialName}'`, symbol!.declaration!, this.symbolFactory.filepath),
          ];
        }
        symbolTable.set(partialInjectionSymbolId, partialInjectionSymbol);
      }
      if (field.args.length) {
        errors.push(
          ...field.args.map((arg) => new CompileError(CompileErrorCode.INVALID_TABLE_PARTIAL_INJECTION, 'A partial injection does not have any trailing attributes', arg, this.symbolFactory.filepath)),
        );
      }
      return errors;
    };
    return fields.flatMap((field) => {
      if (field.callee instanceof PrefixExpressionNode && field.callee.op?.value === '~') return validatePartialInjection(field);
      return validateColumn(field);
    });
  }

  registerField (field: FunctionApplicationNode): CompileError[] {
    if (field.callee && isExpressionAVariableNode(field.callee)) {
      const columnName = extractVarNameFromPrimaryVariable(field.callee).unwrap();
      const columnId = createColumnSymbolIndex(columnName);

      const columnSymbol = this.symbolFactory.create(ColumnSymbol, { declaration: field });
      this.nodeToSymbol.set(field, columnSymbol);

      const symbolTable = (this.nodeToSymbol.get(this.declarationNode) as TableSymbol)!.symbolTable!;
      if (symbolTable.has(columnId)) {
        const symbol = symbolTable.get(columnId);
        return [
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, field, this.symbolFactory.filepath),
          new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate column ${columnName}`, symbol!.declaration!, this.symbolFactory.filepath),
        ];
      }
      symbolTable.set(columnId, columnSymbol);
    }
    return [];
  }

  // This is needed to support legacy inline settings
  validateFieldSetting (parts: ExpressionNode[]): CompileError[] {
    if (!parts.slice(0, -1).every(isExpressionAnIdentifierNode) || !parts.slice(-1).every((p) => isExpressionAnIdentifierNode(p) || p instanceof ListExpressionNode)) {
      return [...parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part, this.symbolFactory.filepath))];
    }

    if (parts.length === 0) {
      return [];
    }

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
      if (name !== 'pk' && name !== 'unique') {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part, this.symbolFactory.filepath));
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
      errors.push(
        ...[...pkAttrs, ...pkeyAttrs]
          .map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'Either one of \'primary key\' and \'pk\' can appear', attr, this.symbolFactory.filepath)),
      );
    }

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'note can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'note\' must be a quoted string', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.Ref:
          attrs.forEach((attr) => {
            if (!isUnaryRelationship(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.PrimaryKey:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'primary key can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'primary key\' must not have a value', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.PK:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'pk\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'pk\' must not have a value', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.NotNull: {
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'not null\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          const nullAttrs = settingMap[SettingName.Null] || [];
          if (attrs.length >= 1 && nullAttrs.length >= 1) {
            errors.push(
              ...[...attrs, ...nullAttrs]
                .map((attr) => new CompileError(CompileErrorCode.CONFLICTING_SETTING, '\'not null\' and \'null\' can not be set at the same time', attr, this.symbolFactory.filepath)),
            );
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'not null\' must not have a value', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        }
        case SettingName.Null:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'null\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'null\' must not have a value', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.Unique:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'unique\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'unique\' must not have a value', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.Increment:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'increment\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'increment\' must not have a value', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.Default:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'default\' can only appear once', attr, this.symbolFactory.filepath)));
          }
          attrs.forEach((attr) => {
            if (!isValidDefaultValue(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                '\'default\' must be an enum value, a string literal, number literal, function expression, true, false or null',
                attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;
        case SettingName.Check:
          attrs.forEach((attr) => {
            if (!(attr.value instanceof FunctionExpressionNode)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attr.value || attr.name!, this.symbolFactory.filepath));
            }
          });
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr, this.symbolFactory.filepath)));
      }
    });
    return errors;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Validator = pickElementValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator({ declarationNode: sub as ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: this.publicSymbolTable, nodeToSymbol: this.nodeToSymbol }, this.symbolFactory);
      return validator.validate().errors;
    });

    const notes = subs.filter((sub) => sub.type?.value.toLowerCase() === 'note');
    if (notes.length > 1) {
      errors.push(...notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note, this.symbolFactory.filepath)));
    }

    return errors;
  }
}

function isAliasSameAsName (alias: string, nameFragments: string[]): boolean {
  return nameFragments.length === 1 && alias === nameFragments[0];
}
