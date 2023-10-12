import SymbolFactory from '../../symbol/factory';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isExpressionAVariableNode, isExpressionAQuotedString } from '../../../parser/utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  complexBodyConfig,
  noAliasConfig,
  noSettingListConfig,
  noUniqueConfig,
  registerNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';
import { transformToReturnCompileErrors } from './utils';
import { SyntaxToken } from '../../../lexer/tokens';

export default class EnumValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.ENUM;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.EnumContext,
    errorCode: CompileErrorCode.INVALID_ENUM_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig.doNotStopOnError();

  protected name = registerNameConfig.doNotStopOnError();

  protected alias = noAliasConfig.doNotStopOnError();

  protected settingList = noSettingListConfig.doNotStopOnError();

  protected body = complexBodyConfig.doNotStopOnError();

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: transformToReturnCompileErrors(
          isExpressionAVariableNode,
          CompileErrorCode.INVALID_ENUM_ELEMENT_NAME,
          'This field must be a simple variable',
        ),
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT,
    invalidArgNumberErrorMessage: "An enum's field must be a simple variable",
    settingList: enumFieldSettingList(),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_NAME,
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

const enumFieldSettingList = () =>
  createSettingListValidatorConfig(
    {
      note: {
        allowDuplicate: true,
        isValid: isExpressionAQuotedString,
      },
    },
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: true,
      notAllowErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_ENUM_ELEMENT_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING,
      stopOnError: false,
    },
  );
