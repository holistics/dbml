import { SyntaxToken, SyntaxTokenKind } from '../../../lexer/tokens';
import SymbolFactory from '../../symbol/factory';
import { transformToReturnCompileErrors } from './utils';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode, IdentiferStreamNode, SyntaxNode } from '../../../parser/nodes';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import { isBinaryRelationship } from '../utils';
import {
  anyBodyConfig,
  noAliasConfig,
  noSettingListConfig,
  noUniqueConfig,
  optionalNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';
import {
  extractStringFromIdentifierStream,
  isExpressionAVariableNode,
} from '../../../parser/utils';

export default class RefValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.REF;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.RefContext,
    errorCode: CompileErrorCode.INVALID_REF_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig.doNotStopOnError();

  protected name = optionalNameConfig.doNotStopOnError();

  protected alias = noAliasConfig.doNotStopOnError();

  protected settingList = noSettingListConfig.doNotStopOnError();

  protected body = anyBodyConfig.doNotStopOnError();

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: transformToReturnCompileErrors(
          isBinaryRelationship,
          CompileErrorCode.INVALID_REF_RELATIONSHIP,
          'This field must be a valid binary relationship',
        ),
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_REF_FIELD,
    invalidArgNumberErrorMessage: "A ref's field must be a single valid binary relationship",
    settingList: refFieldSettings(),
    shouldRegister: false,
    duplicateErrorCode: undefined,
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

function isValidPolicy(value?: SyntaxNode): boolean {
  if (
    !(
      isExpressionAVariableNode(value) &&
      value.expression.variable.kind !== SyntaxTokenKind.QUOTED_STRING
    ) &&
    !(value instanceof IdentiferStreamNode)
  ) {
    return false;
  }

  let extractedString: string | undefined;
  if (value instanceof IdentiferStreamNode) {
    extractedString = extractStringFromIdentifierStream(value).unwrap_or('');
  } else {
    extractedString = value.expression.variable.value;
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}

const refFieldSettings = () =>
  createSettingListValidatorConfig(
    {
      delete: {
        allowDuplicate: false,
        isValid: isValidPolicy,
      },
      update: {
        allowDuplicate: false,
        isValid: isValidPolicy,
      },
    },
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: true,
      notAllowErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_REF_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_REF_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_REF_SETTING_VALUE,
      stopOnError: false,
    },
  );
