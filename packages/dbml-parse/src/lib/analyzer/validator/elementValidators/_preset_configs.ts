import { CompileErrorCode } from '../../../errors';
import {
  UniqueElementValidatorConfig,
  createAliasValidatorConfig,
  createBodyValidatorConfig,
  createNameValidatorConfig,
  createSettingListValidatorConfig,
  createUniqueValidatorConfig,
} from '../types';

// A wrapper for preset configs
// so that `stopOnError` configuration by element validators is more readable
class PartialConfig<T extends { stopOnError: boolean }> {
  partialConfig: T;

  constructor(config: T) {
    this.partialConfig = config;
  }

  doNotStopOnError(): T {
    this.partialConfig.stopOnError = false;

    return this.partialConfig;
  }

  stopOnError(): T {
    this.partialConfig.stopOnError = true;

    return this.partialConfig;
  }
}

// A config that allows any body form
const anyBodyConfig = new PartialConfig(
  createBodyValidatorConfig({
    allowSimple: true,
    simpleErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,

    stopOnError: false,
  }),
);

// A config that allows only simple body
const simpleBodyConfig = new PartialConfig(
  createBodyValidatorConfig({
    allowSimple: true,
    simpleErrorCode: undefined,
    allowComplex: false,
    complexErrorCode: CompileErrorCode.UNEXPECTED_COMPLEX_BODY,

    stopOnError: false,
  }),
);

// A config that allows only complex body
const complexBodyConfig = new PartialConfig(
  createBodyValidatorConfig({
    allowSimple: false,
    simpleErrorCode: CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
    allowComplex: true,
    complexErrorCode: undefined,

    stopOnError: false,
  }),
);

// A config that allows optional alias
const optionalAliasConfig = new PartialConfig(
  createAliasValidatorConfig({
    optional: true,
    notOptionalErrorCode: undefined,
    allow: true,
    notAllowErrorCode: undefined,

    stopOnError: false,
  }),
);

// A config that allows optional name
const optionalNameConfig = new PartialConfig(
  createNameValidatorConfig({
    optional: true,
    notOptionalErrorCode: undefined,
    allow: true,
    notAllowErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: false,
    duplicateErrorCode: undefined,

    stopOnError: false,
  }),
);

// A config that mandate name registration
const registerNameConfig = new PartialConfig(
  createNameValidatorConfig({
    optional: false,
    notOptionalErrorCode: CompileErrorCode.NAME_NOT_FOUND,
    allow: true,
    notAllowErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_NAME,

    stopOnError: false,
  }),
);

// A config that mandates that there are no settings
const noSettingListConfig = new PartialConfig(
  createSettingListValidatorConfig(
    {},
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: false,
      notAllowErrorCode: CompileErrorCode.UNEXPECTED_SETTINGS,
      unknownErrorCode: undefined,
      duplicateErrorCode: undefined,
      invalidErrorCode: undefined,

      stopOnError: false,
    },
  ),
);

// A config that mandates that the element must be locally unique
export function locallyUniqueConfig(
  errorCode: CompileErrorCode,
): PartialConfig<UniqueElementValidatorConfig> {
  return new PartialConfig(
    createUniqueValidatorConfig({
      globally: false,
      notGloballyErrorCode: undefined,
      locally: true,
      notLocallyErrorCode: errorCode,

      stopOnError: false,
    }),
  );
}

// A config that mandates that the element must be globally unique
export function globallyUniqueConfig(
  errorCode: CompileErrorCode,
): PartialConfig<UniqueElementValidatorConfig> {
  return new PartialConfig(
    createUniqueValidatorConfig({
      globally: true,
      notGloballyErrorCode: errorCode,
      locally: false,
      notLocallyErrorCode: undefined,

      stopOnError: false,
    }),
  );
}

// A config that does not enforce uniqueness constraint
const noUniqueConfig = new PartialConfig(
  createUniqueValidatorConfig({
    globally: false,
    notGloballyErrorCode: undefined,
    locally: false,
    notLocallyErrorCode: undefined,

    stopOnError: false,
  }),
);

// A config that does not allow element name
const noNameConfig = new PartialConfig(
  createNameValidatorConfig({
    optional: true,
    notOptionalErrorCode: undefined,
    allow: false,
    notAllowErrorCode: CompileErrorCode.UNEXPECTED_NAME,
    allowComplex: false,
    complexErrorCode: CompileErrorCode.UNEXPECTED_NAME,
    shouldRegister: false,
    duplicateErrorCode: undefined,

    stopOnError: false,
  }),
);

// A config that does not allow element alias
const noAliasConfig = new PartialConfig(
  createAliasValidatorConfig({
    optional: true,
    notOptionalErrorCode: undefined,
    allow: false,
    notAllowErrorCode: CompileErrorCode.UNEXPECTED_ALIAS,
    stopOnError: false,
  }),
);

export {
  anyBodyConfig,
  simpleBodyConfig,
  complexBodyConfig,
  noAliasConfig,
  noNameConfig,
  noSettingListConfig,
  registerNameConfig,
  noUniqueConfig,
  optionalAliasConfig,
  optionalNameConfig,
};
