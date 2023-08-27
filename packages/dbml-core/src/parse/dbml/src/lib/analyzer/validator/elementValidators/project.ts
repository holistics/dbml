import SymbolFactory from 'lib/analyzer/symbol/factory';
import { UnresolvedName } from '../../types';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  complexBodyConfig,
  globallyUniqueConfig,
  noAliasConfig,
  noSettingListConfig,
  optionalNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

export default class ProjectValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.PROJECT;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.ProjectContext,
    errorCode: CompileErrorCode.INVALID_PROJECT_CONTEXT,
    stopOnError: false,
  });

  protected unique = globallyUniqueConfig(CompileErrorCode.PROJECT_REDEFINED).doNotStopOnError();

  protected name = optionalNameConfig.doNotStopOnError();

  protected alias = noAliasConfig.doNotStopOnError();

  protected settingList = noSettingListConfig.doNotStopOnError();

  protected body = complexBodyConfig.doNotStopOnError();

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_PROJECT_FIELD,
    settingList: noSettingListConfig.doNotStopOnError(),
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
