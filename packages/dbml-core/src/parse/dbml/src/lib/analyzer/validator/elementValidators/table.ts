import SymbolFactory from '../../symbol/factory';
import {
  BindingRequest,
  createIgnorableBindingRequest,
  createNonIgnorableBindingRequest,
} from '../../types';
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
  destructureComplexVariable,
  destructureMemberAccessExpression,
  extractVariableFromExpression,
} from '../../utils';
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
import { registerRelationshipOperand, transformToReturnCompileErrors } from './utils';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '../../../parser/utils';

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
        registerBindingRequest: registerEnumTypeIfComplexVariable,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_COLUMN,
    invalidArgNumberErrorMessage: "A Table's column must have a name and a type",
    settingList: columnSettingList(),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_COLUMN_NAME,
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

function registerEnumTypeIfComplexVariable(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  bindingRequests: BindingRequest[],
) {
  if (!isAccessExpression(node) && !(node instanceof PrimaryExpressionNode)) {
    return;
  }

  if (!isValidColumnType(node)) {
    throw new Error('Unreachable - Invalid type when registerTypeIfComplexVariable is called');
  }

  const fragments = destructureMemberAccessExpression(node).unwrap();
  const _enum = fragments.pop()!;
  const enumId = createEnumSymbolIndex(extractVariableFromExpression(_enum).unwrap());
  const schemaStack = fragments.map((s) => ({
    index: createSchemaSymbolIndex(extractVariableFromExpression(s).unwrap()),
    referrer: s,
  }));

  if (isAccessExpression(node)) {
    bindingRequests.push(
      createNonIgnorableBindingRequest({
        subnames: [...schemaStack, { index: enumId, referrer: _enum }],
        ownerElement,
      }),
    );
  } else {
    bindingRequests.push(
      createIgnorableBindingRequest({
        subnames: [...schemaStack, { index: enumId, referrer: _enum }],
        ownerElement,
      }),
    );
  }
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
        registerBindingRequest: registerUnaryRelationship,
      },
      'primary key': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      default: {
        allowDuplicate: false,
        isValid: isValidDefaultValue,
        registerBindingRequest: registerEnumValueIfComplexVar,
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
  bindingRequests: BindingRequest[],
) {
  if (!isUnaryRelationship(value)) {
    throw new Error('Unreachable - Must be an unary rel when regiterUnaryRelationship is called');
  }
  registerRelationshipOperand(
    (value as PrefixExpressionNode).expression,
    ownerElement,
    bindingRequests,
  );
}

function registerEnumValueIfComplexVar(
  value: SyntaxNode | undefined,
  ownerElement: ElementDeclarationNode,
  bindingRequests: BindingRequest[],
) {
  if (!isValidDefaultValue(value)) {
    throw new Error('Unreachable - Invalid default when registerEnumValueIfComplexVar is called');
  }

  if (value instanceof PrimaryExpressionNode) {
    return;
  }

  const fragments = destructureMemberAccessExpression(value as SyntaxNode).unwrap();
  const enumField = fragments.pop()!;
  const enumFieldId = createEnumFieldSymbolIndex(extractVariableFromExpression(enumField).unwrap());
  const _enum = fragments.pop()!;
  const enumId = createEnumSymbolIndex(extractVariableFromExpression(_enum).unwrap());
  const schemaStack = fragments.map((s) => ({
    referrer: s,
    index: createSchemaSymbolIndex(extractVariableFromExpression(s).unwrap()),
  }));

  bindingRequests.push(
    createNonIgnorableBindingRequest({
      subnames: [
        ...schemaStack,
        { referrer: _enum, index: enumId },
        { referrer: enumField, index: enumFieldId },
      ],
      ownerElement,
    }),
  );
}
