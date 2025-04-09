/* eslint-disable class-methods-use-this */
import { forIn, last } from 'lodash';
import SymbolFactory from '../../symbol/factory';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  AttributeNode, BlockExpressionNode, ElementDeclarationNode, ExpressionNode,
  FunctionApplicationNode, ListExpressionNode, PrimaryExpressionNode, SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isExpressionAnIdentifierNode, isExpressionAQuotedString } from '../../../parser/utils';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  aggregateSettingList, isSimpleName, isUnaryRelationship, isValidColor,
  isValidDefaultValue, isVoid, pickValidator,
} from '../utils';
import { extractVarNameFromPrimaryVariable } from '../../utils';
import SymbolTable from '../../symbol/symbolTable';
import { ElementKind, ElementKindName, SettingName } from '../../types';

export default abstract class ElementValidator {
  protected declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  protected publicSymbolTable: SymbolTable;
  protected symbolFactory: SymbolFactory;
  protected elementKindName: ElementKindName;

  constructor (
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
    publicSymbolTable: SymbolTable,
    symbolFactory: SymbolFactory,
    elementKindName: ElementKindName,
  ) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
    this.elementKindName = elementKindName;
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

  protected abstract validateContext (): CompileError[]

  protected abstract validateName(nameNode?: SyntaxNode): CompileError[]

  protected abstract validateAlias (aliasNode?: SyntaxNode): CompileError[]

  protected abstract validateSettingList (settingList?: ListExpressionNode): CompileError[]

  protected abstract registerElement(): CompileError[]

  protected abstract validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[]

  protected validateUniqueSetting (
    settingName: string,
    attrs: (AttributeNode | PrimaryExpressionNode)[],
    errorCode: CompileErrorCode,
  ) {
    return attrs.length <= 1
      ? []
      : attrs.map((attr) => new CompileError(errorCode, `'${settingName}' can only appear once`, attr));
  }

  protected validateStringSetting (settingName: string, attrs: AttributeNode[], errorCode: CompileErrorCode) {
    return attrs
      .filter(attr => !isExpressionAQuotedString(attr.value))
      .map(attr => new CompileError(
        errorCode,
        `'${settingName}' must be a string literal`,
        attr,
      ));
  }

  // This is needed to support legacy inline settings
  // Used for Table and TableFragment columns
  // e.g. `id int pk unique [note: 'abc']`
  protected validateColumnSettings (parts: (ExpressionNode | PrimaryExpressionNode & { expression: VariableNode })[]) {
    if (parts.length === 0) return [];

    // algorithm: if last part is not list expression, then it must be identifer node
    // so we can check it with the remaining parts as well
    const isLastPartListExpression = last(parts) instanceof ListExpressionNode;
    const firstParts = (isLastPartListExpression ? parts.slice(0, -1) : parts) as (PrimaryExpressionNode & { expression: VariableNode })[];

    if (!firstParts.every(isExpressionAnIdentifierNode) && !isLastPartListExpression) {
      return [...parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part))];
    }

    const settingList = isLastPartListExpression
      ? last(parts) as ListExpressionNode
      : undefined;

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap: Record<SettingName | string, (AttributeNode | PrimaryExpressionNode)[]> = aggReport.getValue();

    firstParts.forEach((part) => {
      const name = extractVarNameFromPrimaryVariable(part).unwrap_or('').toLowerCase();

      if (name !== SettingName.PK && name !== SettingName.Unique) {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
        return;
      }

      if (settingMap[name] === undefined) settingMap[name] = [];
      settingMap[name].push(part);
    });

    forIn(settingMap, (attrs, name) => {
      if (!attrs) return;

      switch (name) {
        case SettingName.PK:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
          errors.push(...this.validateNonValueSetting(name, attrs, CompileErrorCode.INVALID_COLUMN_SETTING_VALUE));
          errors.push(...this.validatePrimaryKeyAndPKSetting(attrs, settingMap[SettingName.PKey]));
          break;

        case SettingName.Note:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
          errors.push(...this.validateStringSetting(name, attrs as AttributeNode[], CompileErrorCode.INVALID_COLUMN_SETTING_VALUE));
          break;

        case SettingName.Ref:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
          (attrs as AttributeNode[]).forEach((attr) => {
            if (!isUnaryRelationship(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!));
            }
          });
          break;

        case SettingName.Null:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
          errors.push(...this.validateNonValueSetting(name, attrs, CompileErrorCode.INVALID_COLUMN_SETTING_VALUE));
          errors.push(...this.validateNullAndNotNullSetting(attrs, settingMap[SettingName.NotNull]));
          break;

        case SettingName.Default:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
          (attrs as AttributeNode[]).forEach((attr) => {
            if (!isValidDefaultValue(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                '\'default\' must be a string literal, number literal, function expression, true, false or null',
                attr.value || attr.name!,
              ));
            }
          });
          break;

        case SettingName.PKey:
        case SettingName.Unique:
        case SettingName.NotNull:
        case SettingName.Increment:
          errors.push(...this.validateUniqueSetting(name, attrs, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
          errors.push(...this.validateNonValueSetting(name, attrs, CompileErrorCode.INVALID_COLUMN_SETTING_VALUE));
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr)));
      }
    });

    return errors;
  }

  protected validateNullAndNotNullSetting (
    nullAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
    notNullAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
  ) {
    if (notNullAttrs === undefined || nullAttrs === undefined) return [];

    if (notNullAttrs.length >= 1 && nullAttrs.length >= 1) {
      return [...notNullAttrs, ...nullAttrs].map((attr) => new CompileError(
        CompileErrorCode.CONFLICTING_SETTING,
        '\'not null\' and \'null\' can not be set at the same time',
        attr,
      ));
    }

    return [];
  }

  protected validatePrimaryKeyAndPKSetting (
    pkAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
    pkeyAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
  ) {
    if (pkAttrs === undefined || pkeyAttrs === undefined) return [];

    if (pkAttrs.length >= 1 && pkeyAttrs.length >= 1) {
      return [...pkAttrs, ...pkeyAttrs].map((attr) => new CompileError(
        CompileErrorCode.DUPLICATE_COLUMN_SETTING,
        'Either one of \'primary key\' and \'pk\' can appear',
        attr,
      ));
    }

    return [];
  }

  protected validateNonValueSetting (
    settingName: string,
    attrs: (AttributeNode | PrimaryExpressionNode)[],
    errorCode: CompileErrorCode,
  ) {
    return attrs
      .filter((attr) => attr instanceof AttributeNode && !isVoid(attr.value))
      .map((attr: AttributeNode) => new CompileError(
        errorCode,
        `'${settingName}' must not have a value`,
        attr.value || attr.name!,
      ));
  }

  protected validateColorSetting (settingName: string, attrs: AttributeNode[], errorCode: CompileErrorCode) {
    return attrs
      .filter((attr) => !isValidColor(attr.value))
      .map((attr) => new CompileError(
        errorCode,
        `'${settingName}' must be a color literal`,
        attr.value || attr.name!,
      ));
  }

  protected validateTopLevelContext (declarationNode: ElementDeclarationNode) {
    const errorCodeBySymbolKind: Record<string, CompileErrorCode> = {
      [ElementKindName.Table]: CompileErrorCode.INVALID_TABLE_CONTEXT,
      [ElementKindName.Enum]: CompileErrorCode.INVALID_ENUM_CONTEXT,
      [ElementKindName.TableGroup]: CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
      [ElementKindName.TableFragment]: CompileErrorCode.INVALID_TABLE_FRAGMENT_CONTEXT,
      [ElementKindName.Project]: CompileErrorCode.INVALID_PROJECT_CONTEXT,
      [ElementKindName.Ref]: CompileErrorCode.INVALID_REF_CONTEXT,
    };

    if (declarationNode.parent instanceof ElementDeclarationNode && errorCodeBySymbolKind[this.elementKindName]) {
      return [new CompileError(
        errorCodeBySymbolKind[this.elementKindName],
        `${this.elementKindName} must appear top-level`,
        declarationNode,
      )];
    }

    return [];
  }

  protected validateSimpleName (nameNode: SyntaxNode | undefined, declarationNode: ElementDeclarationNode) {
    if (!nameNode) {
      return [new CompileError(
        CompileErrorCode.NAME_NOT_FOUND,
        `${this.elementKindName} must have a name`,
        declarationNode,
      )];
    }

    if (!isSimpleName(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_NAME,
        `${this.elementKindName} name must be a single identifier or a quoted identifer`,
        nameNode,
      )];
    }

    return [];
  }

  protected validateOptionalSimpleName (nameNode?: SyntaxNode) {
    return (nameNode && !isSimpleName(nameNode))
      ? [new CompileError(
        CompileErrorCode.INVALID_NAME,
        `${this.elementKindName} name is optional or must be a single identifier or a quoted identifer`,
        nameNode,
      )]
      : [];
  }

  protected validateNoAlias (aliasNode?: SyntaxNode) {
    return !aliasNode
      ? []
      : [new CompileError(
        CompileErrorCode.UNEXPECTED_ALIAS,
        `${this.elementKindName} shouldn't have an alias`,
        aliasNode,
      )];
  }

  protected validateNoSettingList (settingList?: ListExpressionNode) {
    return !settingList
      ? []
      : [new CompileError(
        CompileErrorCode.UNEXPECTED_SETTINGS,
        `${this.elementKindName} shouldn't have a setting list`,
        settingList,
      )];
  }

  protected validateSubElementsWithOwnedValidators (
    subElements: ElementDeclarationNode[],
    declarationNode: ElementDeclarationNode,
    publicSymbolTable: SymbolTable,
    symbolFactory: SymbolFactory,
  ) {
    return subElements.flatMap((subElement) => {
      subElement.parent = declarationNode;
      if (!subElement.type) return [];

      const Validator = pickValidator(subElement as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new Validator(subElement as ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable, symbolFactory);
      return validator.validate();
    });
  }

  protected validateNotesAsSubElements (subElements: ElementDeclarationNode[]) {
    const notes = subElements.filter((subElement) => subElement.type?.value.toLowerCase() === ElementKind.Note);

    return notes.length <= 1
      ? []
      : notes.map((note) => new CompileError(CompileErrorCode.NOTE_REDEFINED, 'Duplicate notes are defined', note));
  }
}
