/* eslint-disable class-methods-use-this */
import { last, forIn } from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  PartialInjectionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable } from '../../utils';
import {
  aggregateSettingList,
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
} from '../utils';
import { ElementValidator } from '../types';
import { ColumnSymbol, TablePartialInjectionSymbol, TableSymbol } from '../../symbol/symbols';
import { createColumnSymbolIndex, createTablePartialInjectionSymbolIndex, createTableSymbolIndex } from '../../symbol/symbolIndex';
import {
  isExpressionAQuotedString,
  isExpressionAVariableNode,
  isExpressionAnIdentifierNode,
} from '../../../parser/utils';
import { SyntaxToken } from '../../../lexer/tokens';
import SymbolTable from '../../symbol/symbolTable';
import { SettingName } from '../../types';

export default class TableValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private symbolFactory: SymbolFactory;
  private publicSymbolTable: SymbolTable;

  constructor(
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
    publicSymbolTable: SymbolTable,
    symbolFactory: SymbolFactory,
  ) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.publicSymbolTable = publicSymbolTable;
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
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, 'Table must appear top-level', this.declarationNode)];
    }
    return [];
  }

  private validateName(nameNode?: SyntaxNode): CompileError[] {
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

  private validateAlias(aliasNode?: SyntaxNode): CompileError[] {
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

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.HeaderColor:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'headercolor\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidColor(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'headercolor\' must be a color literal', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, '\'note\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'note\' must be a string literal', attr.value || attr.name!));
            }
          });
          break;
        default:
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.UNKNOWN_TABLE_SETTING, `Unknown '${name}' setting`, attr)));
      }
    });
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
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${tableName}' already exists in schema '${nameFragments.join('.') || 'public'}'`, name!));
      }
      symbolTable.set(tableId, this.declarationNode.symbol!);
    }

    if (
      alias && isSimpleName(alias)
      // eslint-disable-next-line no-use-before-define
      && !isAliasSameAsName(alias.expression.variable!.value, maybeNameFragments.unwrap_or([]))
    ) {
      const aliasName = extractVarNameFromPrimaryVariable(alias as any).unwrap();
      const aliasId = createTableSymbolIndex(aliasName);
      if (this.publicSymbolTable.has(aliasId)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_NAME, `Table name '${aliasName}' already exists`, name!));
      }
      this.publicSymbolTable.set(aliasId, this.declarationNode.symbol!);
    }

    return errors;
  }

  validateBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Table\'s body must be a block', body)];
    }

    const [fields, injections, subs] = body.body.reduce((res: [FunctionApplicationNode[], PartialInjectionNode[], ElementDeclarationNode[]], node) => {
      if (node instanceof FunctionApplicationNode) res[0].push(node);
      else if (node instanceof PartialInjectionNode) res[1].push(node);
      else if (node instanceof ElementDeclarationNode) res[2].push(node);
      return res;
    }, [[], [], []]);

    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateInjections(injections as PartialInjectionNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  validateInjections(injections: PartialInjectionNode[]) {
    return injections.flatMap((injection) => this.registerInjection(injection));
  }

  registerInjection(injection: PartialInjectionNode) {
    if (!injection.partial?.variable?.value) return [];

    const injectionName = injection.partial.variable?.value;
    const injectionId = createTablePartialInjectionSymbolIndex(injectionName);

    const injectionSymbol = this.symbolFactory.create(TablePartialInjectionSymbol, { declaration: injection });
    injection.symbol = injectionSymbol;

    const symbolTable = this.declarationNode.symbol!.symbolTable!;
    const duplicateSymbol = symbolTable.get(injectionId);
    if (duplicateSymbol) {
      return [
        new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_INJECTION_NAME, `Duplicate injection ${injectionName}`, injection),
        new CompileError(CompileErrorCode.DUPLICATE_TABLE_PARTIAL_INJECTION_NAME, `Duplicate injection ${injectionName}`, duplicateSymbol.declaration!),
      ];
    }
    symbolTable.set(injectionId, injectionSymbol);
    return [];
  }

  validateFields(fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      const errors: CompileError[] = [];
      if (field.args.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!));
      }

      if (!isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee));
      }

      // eslint-disable-next-line no-use-before-define
      if (field.args[0] && !isValidColumnType(field.args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0]));
      }

      const remains = field.args.slice(1);
      errors.push(...this.validateFieldSetting(remains));

      errors.push(...this.registerField(field));

      return errors;
    });
  }

  registerField(field: FunctionApplicationNode): CompileError[] {
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

  // This is needed to support legacy inline settings
  validateFieldSetting(parts: ExpressionNode[]): CompileError[] {
    if (!parts.slice(0, -1).every(isExpressionAnIdentifierNode) || !parts.slice(-1).every((p) => isExpressionAnIdentifierNode(p) || p instanceof ListExpressionNode)) {
      return [...parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part))];
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
      pk?: (AttributeNode | PrimaryExpressionNode)[],
      unique?: (AttributeNode | PrimaryExpressionNode)[],
    } = aggReport.getValue();

    parts.forEach((part) => {
      const name = extractVarNameFromPrimaryVariable(part as any).unwrap_or('').toLowerCase();
      if (name !== 'pk' && name !== 'unique') {
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
      errors.push(
        ...[...pkAttrs, ...pkeyAttrs]
          .map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'Either one of \'primary key\' and \'pk\' can appear', attr)),
      );
    }

    forIn(settingMap, (attrs, name) => {
      switch (name) {
        case SettingName.Note:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'note can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isExpressionAQuotedString(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'note\' must be a quoted string', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Ref:
          attrs.forEach((attr) => {
            if (!isUnaryRelationship(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.PrimaryKey:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'primary key can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'primary key\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.PK:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'pk\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'pk\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.NotNull: {
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'not null\' can only appear once', attr)));
          }
          const nullAttrs = settingMap[SettingName.Null] || [];
          if (attrs.length >= 1 && nullAttrs.length >= 1) {
            errors.push(
              ...[...attrs, ...nullAttrs]
                .map((attr) => new CompileError(CompileErrorCode.CONFLICTING_SETTING, '\'not null\' and \'null\' can not be set at the same time', attr)),
            );
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'not null\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        }
        case SettingName.Null:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'null\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'null\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Unique:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'unique\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'unique\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Increment:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'increment\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (attr instanceof AttributeNode && !isVoid(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'increment\' must not have a value', attr.value || attr.name!));
            }
          });
          break;
        case SettingName.Default:
          if (attrs.length > 1) {
            errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'default\' can only appear once', attr)));
          }
          attrs.forEach((attr) => {
            if (!isValidDefaultValue(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                '\'default\' must be a string literal, number literal, function expression, true, false or null',
                attr.value || attr.name!,
              ));
            }
          });
          break;
        case SettingName.Constraint:
          attrs.forEach((attr) => {
            if (!(attr.value instanceof FunctionExpressionNode)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'constraint\' must be a function expression', attr.value || attr.name!));
            }
          });
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr)));
      }
    });
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

function isAliasSameAsName(alias: string, nameFragments: string[]): boolean {
  return nameFragments.length === 1 && alias === nameFragments[0];
}
