import { ElementDeclarationNode, SyntaxNode } from '../../parser/nodes';
import { CompileError, CompileErrorCode } from '../../errors';
import { None, Option, Some } from '../../option';
import { ValidatorContext } from './validatorContext';
import { UnresolvedName } from '../types';

// Each element has its own element kind
// Except for custom elements, which all fall under one kind
// e.g
// Project {
//   project_name: 'My project' // custom element
//   version: '1.0.0' // custom element
// }
export enum ElementKind {
  TABLE = 'Table',
  ENUM = 'Enum',
  INDEXES = 'Indexes',
  NOTE = 'Note',
  PROJECT = 'Project',
  REF = 'Ref',
  TABLEGROUP = 'TableGroup',
  CUSTOM = 'custom element',
}

// An object that can validate a certain setting
// e.g Table [headercolor: #123]
//   -> headercolor has its own SettingValidator
export interface SettingValidator {
  // Whether the setting is allowed to appear more than once
  // e.g id integer [ref: > Products.uid, ref: ...]
  //  -> ref can be duplicated
  // e.g Table [note: 'this is a note']
  //  -> note can not be duplicated
  allowDuplicate: boolean;

  // A callback that validates whether `value` is valid for the setting
  isValid: (value?: SyntaxNode) => boolean;

  // An optional callback that registers the setting value for later name resolution
  registerUnresolvedName?(
    value: SyntaxNode | undefined,
    ownerElement: ElementDeclarationNode,
    unresolvedNames: UnresolvedName[],
  ): void;
}

// An object that can validates a term in an element's subfield
// By definition, an element's subfield is a single primary expression
// or a function application, which can have many arguments
// The callee is also treated as an argument
// e.g
// Table Users {
//   id integer [pk] // 'id' and 'integer' have their own validator
//                   // '[pk]' is validated by the Table's subfield setting validator
// }
//
export interface ArgumentValidator {
  // Validator whether the node is a valid argument
  // `ith` is a number representing the order of the subfield in the element
  //   This parameter can be useful in cases
  //   for example, where the first subfield has a different semantics from the rests
  validateArg(node: SyntaxNode, ith: number): CompileError[];

  // An optional callback that registers an argument for later name resolution
  registerUnresolvedName?(
    node: SyntaxNode,
    ownerElement: ElementDeclarationNode,
    unresolvedNames: UnresolvedName[],
  ): void;
}

// A configuration object
// that dictates whether an element can appear within a certain `context`
// e.g
//   A Table can not appear inside a RefContext
export interface ContextValidatorConfig {
  // Which context is associated with this configuration?
  name: Readonly<ValidatorContext>;
  errorCode: Readonly<CompileErrorCode>;

  // Should the validation stops immediately upon context checking failure?
  stopOnError: Readonly<boolean>;
}

// A configuration object
// that dictates whether an element must be unique globally or locally in the current scope
// e.g
//   There can only be one Project -> globally unique
//   There can not be more than one Notes in a Table -> locally unique
export interface UniqueElementValidatorConfig {
  globally: Readonly<boolean>;
  notGloballyErrorCode?: Readonly<CompileErrorCode>;

  locally: Readonly<boolean>;
  notLocallyErrorCode?: Readonly<CompileErrorCode>;

  // Should the validation process stops immediately upon uniqueness checking failure?
  stopOnError: Readonly<boolean>;
}

// A configuration object
// that dictates the format of an element's name
// e.g
//   A Table name is not optional, can be complex (v2.Users) and must be registrated
//   A Ref name is optional, can be complex and is not registrated (no uniqueness constraint)
export interface NameValidatorConfig {
  // Is the name optional
  optional: Readonly<boolean>;
  notOptionalErrorCode?: Readonly<CompileErrorCode>;

  // Is it allowed to have a name
  allow: Readonly<boolean>;
  notAllowErrorCode?: Readonly<CompileErrorCode>;

  // Is it allowed to be complex
  allowComplex: Readonly<boolean>;
  complexErrorCode?: Readonly<CompileErrorCode>;

  // Should it be registered
  shouldRegister: Readonly<boolean>;
  duplicateErrorCode?: Readonly<CompileErrorCode>;

  // Should the validation process stops immediately upon name checking failure?
  stopOnError: Readonly<boolean>;
}

// A configuration object
// that dictates the format of an element's alias
// e.g
//   Only Tables are allowed to have aliases
export interface AliasValidatorConfig {
  // Is the alias optional
  optional: Readonly<boolean>;
  notOptionalErrorCode?: Readonly<CompileErrorCode>;

  // Is it allowed to have an alias
  allow: Readonly<boolean>;
  notAllowErrorCode?: Readonly<CompileErrorCode>;

  // Should the validation process stop immediately upon alias checking failure
  stopOnError: Readonly<boolean>;
}

// A configuration object
// that dictates the settings allowed on an element or a subfield
export interface SettingListValidatorConfig {
  // Is the settingList optional
  optional: Readonly<boolean>;
  notOptionalErrorCode?: Readonly<CompileErrorCode>;

  // Is it allowed to have settingList
  allow: Readonly<boolean>;
  notAllowErrorCode?: Readonly<CompileErrorCode>;

  // Error Code for unknown setting name
  unknownErrorCode?: Readonly<CompileErrorCode>;
  // Error Code for duplicate setting name (if the setting is not allowed to have duplicate)
  duplicateErrorCode?: Readonly<CompileErrorCode>;
  // Error Code for unknown setting name
  invalidErrorCode?: Readonly<CompileErrorCode>;

  // Should the validation process stop immediately upon setting list checking failure
  stopOnError: Readonly<boolean>;

  // A function that determines whether a specific value is allowed for a specific setting
  // Return `Some(true)` if it's allowed
  //        `Some(false)` if it's not allowed
  //        `None` if the setting name is unknown
  isValid(name: string, value?: SyntaxNode): Option<boolean>;

  // A function that determines whether a specific setting is allowed to be duplicated
  // Return value is similar to `isValid`
  allowDuplicate(name: string): Option<boolean>;

  // A function that can register a value of a setting for later name resolution
  registerUnresolvedName(
    settingName: string,
    value: SyntaxNode | undefined,
    ownerElement: ElementDeclarationNode,
    unresolvedNames: UnresolvedName[],
  ): void;
}

// A configuration object
// that dictates the format of an element body
export interface BodyValidatorConfig {
  // Can the body be simple
  // e.g Ref: Users.id < Products.uid
  allowSimple: Readonly<boolean>;
  simpleErrorCode?: Readonly<CompileErrorCode>;

  // Can the body be complex
  // e.g Table Users {
  //
  // }
  allowComplex: Readonly<boolean>;
  complexErrorCode?: Readonly<CompileErrorCode>;

  // Should the validation process stop immediately upon body checking failure
  stopOnError: Readonly<boolean>;
}

// A configuration object
// that dictates the format of a subfield
// e.g A Table subfield (column) must have 2 args, including the callee,
//     but excluding the setting list (optional)
export interface SubFieldValidatorConfig {
  // The list of validators for each argument
  argValidators: Readonly<ArgumentValidator[]>;
  invalidArgNumberErrorCode?: Readonly<CompileErrorCode>;
  invalidArgNumberErrorMessage?: Readonly<string>;

  // The setting list configuration of the subfield
  settingList: Readonly<SettingListValidatorConfig>;

  // Should a subfield's callee be registered
  // For example, a Table's column name can not be duplicated
  shouldRegister: Readonly<boolean>;
  duplicateErrorCode?: Readonly<CompileErrorCode>;
}

export function createContextValidatorConfig(
  config: ContextValidatorConfig,
): ContextValidatorConfig {
  return config;
}

export function createUniqueValidatorConfig(
  config: UniqueElementValidatorConfig,
): UniqueElementValidatorConfig {
  if (config.globally && !config.notGloballyErrorCode) {
    throw new Error(
      'Misconfigurartion: If an element is globally unique, notGloballyErrorCode must be set',
    );
  }

  if (config.locally && !config.notLocallyErrorCode) {
    throw new Error(
      'Misconfigurartion: If an element is locally unique, notLocallyErrorCode must be set',
    );
  }

  return config;
}

export function createNameValidatorConfig(config: NameValidatorConfig): NameValidatorConfig {
  if (!config.optional && !config.notOptionalErrorCode) {
    throw new Error(
      'Misconfiguration: If name is not optional, notOptionalErrorCode must be present',
    );
  }

  if (!config.allow && !config.notAllowErrorCode) {
    throw new Error('Misconfiguration: If name is not allowed, notAllowErrorCode must be present');
  }

  if (config.shouldRegister && !config.duplicateErrorCode) {
    throw new Error(
      'Misconfiguration: If name should be registered, duplicateErrorCode must be present',
    );
  }

  return config;
}

export function createAliasValidatorConfig(config: AliasValidatorConfig): AliasValidatorConfig {
  if (!config.optional && !config.notOptionalErrorCode) {
    throw new Error(
      'Misconfiguration: If alias is not optional, notOptionalErrorCode must be present',
    );
  }

  if (!config.allow && !config.notAllowErrorCode) {
    throw new Error('Misconfiguration: If alias is not allowed, notAllowErrorCode must be present');
  }

  return config;
}

export function createSettingListValidatorConfig(
  validatorMap: { [settingName: string]: SettingValidator },
  config: {
    optional: boolean;
    notOptionalErrorCode?: CompileErrorCode;
    allow: boolean;
    notAllowErrorCode?: CompileErrorCode;
    unknownErrorCode?: CompileErrorCode;
    duplicateErrorCode?: CompileErrorCode;
    invalidErrorCode?: CompileErrorCode;
    stopOnError: boolean;
  },
): SettingListValidatorConfig {
  if (!config.optional && !config.notOptionalErrorCode) {
    throw new Error(
      'Misconfiguration: If settingList is not optional, notOptionalErrorCode must be present',
    );
  }

  if (!config.allow && !config.notAllowErrorCode) {
    throw new Error(
      'Misconfiguration: If settingList is not allowed, notAllowErrorCode must be present',
    );
  }

  if (config.allow && !config.unknownErrorCode) {
    throw new Error(
      'Misconfiguration: If settingList is allowed, unknownErrorCode must be present',
    );
  }

  if (config.allow && !config.duplicateErrorCode) {
    throw new Error(
      'Misconfiguration: If settingList is allowed, duplicateErrorCode must be present',
    );
  }

  if (config.allow && !config.invalidErrorCode) {
    throw new Error(
      'Misconfiguration: If settingList is allowed, notAllowErrorCode must be present',
    );
  }

  return {
    ...config,

    isValid(name: string, value?: SyntaxNode): Option<boolean> {
      const validator = validatorMap[name];
      if (!validator) {
        return new None();
      }

      return new Some(validator.isValid(value));
    },

    allowDuplicate(name: string): Option<boolean> {
      const validator = validatorMap[name];
      if (!validator) {
        return new None();
      }

      return new Some(validator.allowDuplicate);
    },

    registerUnresolvedName(
      settingName: string,
      value: SyntaxNode | undefined,
      ownerElement: ElementDeclarationNode,
      unresolvedNames: UnresolvedName[],
    ): void {
      const validator = validatorMap[settingName];
      if (!validator) {
        throw new Error(
          "Unreachable - registerUnresolvedName must be called after it's sure the setting's there",
        );
      }

      validator.registerUnresolvedName?.call(undefined, value, ownerElement, unresolvedNames);
    },
  };
}

export function createBodyValidatorConfig(config: BodyValidatorConfig): BodyValidatorConfig {
  if (!config.allowSimple && !config.simpleErrorCode) {
    throw new Error('Misconfiguration: If simple body is not allowed, simpleErrorCode must be set');
  }

  if (!config.allowComplex && !config.complexErrorCode) {
    throw new Error(
      'Misconfiguration: If complex body is not allowed, complexErrorCode must be set',
    );
  }

  return config;
}

export function createSubFieldValidatorConfig(
  config: SubFieldValidatorConfig,
): SubFieldValidatorConfig {
  if (
    config.argValidators.length > 0 &&
    (!config.invalidArgNumberErrorCode || !config.invalidArgNumberErrorMessage)
  ) {
    throw new Error(
      // eslint-disable-next-line
      'Misconfiguration: If subfield accepts arguments, invalidArgNumberErrorCode and invalidArgNumberErrorMessage must be present',
    );
  }

  if (config.shouldRegister && !config.duplicateErrorCode) {
    throw new Error(
      'Misconfiguration: If subfield should be registered, duplicateErrorCode must be present',
    );
  }

  return config;
}
