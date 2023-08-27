import SymbolFactory from 'lib/analyzer/symbol/factory';
import { UnresolvedName } from '../../types';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  anyBodyConfig,
  locallyUniqueConfig,
  noAliasConfig,
  noNameConfig,
  noSettingListConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

export default class NoteValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.NOTE;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.NoteContext,
    errorCode: CompileErrorCode.INVALID_NOTE_CONTEXT,
    stopOnError: false,
  });

  protected unique = locallyUniqueConfig(CompileErrorCode.NOTE_REDEFINED).doNotStopOnError();

  protected name = noNameConfig.doNotStopOnError();

  protected alias = noAliasConfig.doNotStopOnError();

  protected settingList = noSettingListConfig.doNotStopOnError();

  protected body = anyBodyConfig.doNotStopOnError();

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isExpressionAQuotedString,
        errorCode: CompileErrorCode.INVALID_NOTE,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_NOTE,
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
