import { UnresolvedName } from '../../types';
import { registerRelationshipOperand } from './utils';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  ElementDeclarationNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../utils';
import { extractQuotedStringToken, extractStringFromIdentifierStream } from '../../utils';
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
        validateArg: isBinaryRelationship,
        errorCode: CompileErrorCode.INVALID_REF_RELATIONSHIP,
        registerUnresolvedName: registerBinaryRelationship,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_REF_FIELD,
    settingList: refFieldSettings(),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    unresolvedNames: UnresolvedName[],
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      unresolvedNames,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
    );
  }
}

function registerBinaryRelationship(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isBinaryRelationship(node)) {
    throw new Error(
      'Unreachable - Must be a binary relationship when registerRelationshipOperands is called',
    );
  }

  registerRelationshipOperand(
    (node as InfixExpressionNode).leftExpression,
    ownerElement,
    unresolvedNames,
  );
  registerRelationshipOperand(
    (node as InfixExpressionNode).rightExpression,
    ownerElement,
    unresolvedNames,
  );
}

function isValidPolicy(value?: SyntaxNode): boolean {
  if (!Array.isArray(value) && !isExpressionAQuotedString(value)) {
    return false;
  }

  let extractedString: string | undefined;
  if (value instanceof IdentiferStreamNode) {
    extractedString = extractStringFromIdentifierStream(value);
  } else {
    extractedString = extractQuotedStringToken(value);
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
