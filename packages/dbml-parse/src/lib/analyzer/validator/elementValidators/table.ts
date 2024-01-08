import SymbolFactory from '../../symbol/factory';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  ArrayNode,
  CallExpressionNode,
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
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
import { createEnumSymbolIndex, createSchemaSymbolIndex } from '../../symbol/symbolIndex';
import { transformToReturnCompileErrors } from './utils';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '../../../parser/utils';
import { SyntaxToken } from '../../../lexer/tokens';

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
        validateArg: transformToReturnCompileErrors(
          isExpressionAVariableNode,
          CompileErrorCode.INVALID_COLUMN_NAME,
          'This field must be a valid column name',
        ),
      },
      {
        validateArg: transformToReturnCompileErrors(
          isValidColumnType,
          CompileErrorCode.INVALID_COLUMN_TYPE,
          'This field must be a valid column type',
        ),
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_COLUMN,
    invalidArgNumberErrorMessage: "A Table's column must have a name and a type",
    settingList: columnSettingList(),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_COLUMN_NAME,
  });

  constructor(
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
    symbolFactory: SymbolFactory,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
      symbolFactory,
    );
  }
}

function isValidColumnType(type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode ||
      isAccessExpression(type) ||
      type instanceof PrimaryExpressionNode ||
      type instanceof ArrayNode
    )
  ) {
    return false;
  }

  if (type instanceof CallExpressionNode) {
    if (type.callee === undefined || type.argumentList === undefined) {
      return false;
    }

    if (!type.argumentList.elementList.every(isExpressionANumber)) {
      return false;
    }

    // eslint-disable-next-line no-param-reassign
    type = type.callee;
  }
  
  while (type instanceof ArrayNode) {
    if (type.array === undefined || type.indexer === undefined) {
      return false;
    }

    if (!type.indexer.elementList.every((attribute) => !attribute.colon && !attribute.value && isExpressionANumber(attribute.name))) {
      return false;
    }

    // eslint-disable-next-line no-param-reassign
    type = type.array;
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
      },
      'primary key': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      default: {
        allowDuplicate: false,
        isValid: isValidDefaultValue,
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
