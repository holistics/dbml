import SymbolFactory from '../../symbol/factory';
import { BindingRequest } from '../../types';
import { createColumnSymbolIndex } from '../../symbol/symbolIndex';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../parser/utils';
import { destructureIndexNode, extractVarNameFromPrimaryVariable } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import { isVoid } from '../utils';
import {
  complexBodyConfig,
  noAliasConfig,
  noNameConfig,
  noSettingListConfig,
  noUniqueConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';
import { transformToReturnCompileErrors } from './utils';

export default class IndexesValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.INDEXES;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.IndexesContext,
    errorCode: CompileErrorCode.INVALID_INDEXES_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig.doNotStopOnError();

  protected name = noNameConfig.doNotStopOnError();

  protected alias = noAliasConfig.doNotStopOnError();

  protected settingList = noSettingListConfig.doNotStopOnError();

  protected body = complexBodyConfig.doNotStopOnError();

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: transformToReturnCompileErrors(
          (node) => destructureIndexNode(node).unwrap_or(undefined) !== undefined,
          CompileErrorCode.INVALID_INDEX,
          'This field must be a function expression, a column name or a tuple of such',
        ),
        registerBindingRequest: registerIndexForResolution,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_INDEX,
    invalidArgNumberErrorMessage:
      'An Indexes field must be a function expression, a column name or a tuple of such',
    settingList: indexSettingList(),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    bindingRequests: BindingRequest[],
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
    symbolFactory: SymbolFactory,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      bindingRequests,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
      symbolFactory,
    );
  }
}

export function registerIndexForResolution(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  bindingRequests: BindingRequest[],
) {
  const columnNodes = destructureIndexNode(node).unwrap_or(undefined)?.nonFunctional;

  if (!columnNodes) {
    throw new Error(
      'Unreachable - Index should be validated before registerIndexForResolution is called',
    );
  }

  columnNodes.forEach((colNode) =>
    bindingRequests.push({
      unresolvedName: {
        subnames: [
          {
            referrer: colNode,
            index: createColumnSymbolIndex(extractVarNameFromPrimaryVariable(colNode)),
          },
        ],
        ownerElement,
      },
      ignoreError: false,
    }));
}

export function isValidIndexesType(value?: SyntaxNode): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable.value;

  return str === 'btree' || str === 'hash';
}

const indexSettingList = () =>
  createSettingListValidatorConfig(
    {
      note: {
        allowDuplicate: false,
        isValid: isExpressionAQuotedString,
      },
      name: {
        allowDuplicate: false,
        isValid: isExpressionAQuotedString,
      },
      type: {
        allowDuplicate: false,
        isValid: isValidIndexesType,
      },
      unique: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      pk: {
        allowDuplicate: false,
        isValid: isVoid,
      },
    },
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: true,
      notAllowErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_INDEX_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_INDEX_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_INDEX_SETTING_VALUE,
      stopOnError: false,
    },
  );
