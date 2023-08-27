import SymbolFactory from 'lib/analyzer/symbol/factory';
import { UnresolvedName } from '../../types';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import {
  isAccessExpression,
  isExpressionAVariableNode,
  isExpressionAQuotedString,
} from '../../../utils';
import { destructureComplexVariable } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  isExpressionANumber,
  isUnaryRelationship,
  isValidColor,
  isValidDefaultValue,
  isVoid,
} from '../utils';
import {
  registerNameConfig,
  optionalAliasConfig,
  complexBodyConfig,
  noUniqueConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';
import {
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createSchemaSymbolIndex,
} from '../../symbol/symbolIndex';
import { registerRelationshipOperand } from './utils';

export default class TableValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLE;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableContext,
    errorCode: CompileErrorCode.INVALID_TABLE_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig.doNotStopOnError();

  protected name = registerNameConfig.doNotStopOnError();

  protected alias = optionalAliasConfig.doNotStopOnError();

  protected settingList = createSettingListValidatorConfig(
    {
      headercolor: {
        allowDuplicate: false,
        isValid: isValidColor,
      },
      note: {
        allowDuplicate: false,
        isValid: isExpressionAQuotedString,
      },
    },
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: true,
      notAllowErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.INVALID_TABLE_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_TABLE_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_TABLE_SETTING,
      stopOnError: false,
    },
  );

  protected body = complexBodyConfig.doNotStopOnError();

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isExpressionAVariableNode,
        errorCode: CompileErrorCode.INVALID_COLUMN_NAME,
      },
      {
        validateArg: isValidColumnType,
        errorCode: CompileErrorCode.INVALID_COLUMN_TYPE,
        registerUnresolvedName: registerEnumTypeIfComplexVariable,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_COLUMN,
    settingList: columnSettingList(),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_COLUMN_NAME,
  });

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    unresolvedNames: UnresolvedName[],
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
    symbolFactory: SymbolFactory,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      unresolvedNames,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
      symbolFactory,
    );
  }
}

function registerEnumTypeIfComplexVariable(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isAccessExpression(node)) {
    return;
  }

  if (!isValidColumnType(node)) {
    throw new Error('Unreachable - Invalid type when registerTypeIfComplexVariable is called');
  }

  const fragments = destructureComplexVariable(node).unwrap();
  const enumId = createEnumSymbolIndex(fragments.pop()!);
  const schemaIdStack = fragments.map(createSchemaSymbolIndex);

  unresolvedNames.push({
    ids: [...schemaIdStack, enumId],
    ownerElement,
    referrer: node,
  });
}

function isValidColumnType(type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode ||
      isAccessExpression(type) ||
      type instanceof PrimaryExpressionNode
    )
  ) {
    return false;
  }

  if (type instanceof CallExpressionNode) {
    if (!type.argumentList.elementList.every(isExpressionANumber)) {
      return false;
    }
    // eslint-disable-next-line no-param-reassign
    type = type.callee;
  }

  const variables = destructureComplexVariable(type).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

const columnSettingList = () =>
  createSettingListValidatorConfig(
    {
      note: {
        allowDuplicate: false,
        isValid: isExpressionAQuotedString,
      },
      ref: {
        allowDuplicate: true,
        isValid: isUnaryRelationship,
        registerUnresolvedName: registerUnaryRelationship,
      },
      'primary key': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      default: {
        allowDuplicate: false,
        isValid: isValidDefaultValue,
        registerUnresolvedName: registerEnumValueIfComplexVar,
      },
      increment: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      'not null': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      null: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      pk: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      unique: {
        allowDuplicate: false,
        isValid: isVoid,
      },
    },
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: true,
      notAllowErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_COLUMN_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_COLUMN_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
      stopOnError: false,
    },
  );

function registerUnaryRelationship(
  value: SyntaxNode | undefined,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isUnaryRelationship(value)) {
    throw new Error('Unreachable - Must be an unary rel when regiterUnaryRelationship is called');
  }
  registerRelationshipOperand(
    (value as PrefixExpressionNode).expression,
    ownerElement,
    unresolvedNames,
  );
}

function registerEnumValueIfComplexVar(
  value: SyntaxNode | undefined,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isValidDefaultValue(value)) {
    throw new Error('Unreachable - Invalid default when registerEnumValueIfComplexVar is called');
  }

  if (value instanceof PrimaryExpressionNode) {
    return;
  }

  const fragments = destructureComplexVariable(value as SyntaxNode).unwrap();
  const enumFieldId = createEnumFieldSymbolIndex(fragments.pop()!);
  const enumId = createEnumSymbolIndex(fragments.pop()!);
  const schemaId = fragments.map(createSchemaSymbolIndex);

  unresolvedNames.push({
    ids: [...schemaId, enumId, enumFieldId],
    ownerElement,
    referrer: value as SyntaxNode,
  });
}
