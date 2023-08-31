import { UnresolvedName } from '../../types';
import {
  AliasValidatorConfig,
  BodyValidatorConfig,
  ContextValidatorConfig,
  ElementKind,
  NameValidatorConfig,
  SettingListValidatorConfig,
  SubFieldValidatorConfig,
  UniqueElementValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { None, Option, Some } from '../../../option';
import {
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  ListExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { extractVariableNode } from '../../../utils';
import { destructureComplexVariable, extractStringFromIdentifierStream } from '../../utils';
import { ContextStack, canBeNestedWithin } from '../validatorContext';
import {
  hasComplexBody,
  hasSimpleBody,
  isSimpleName,
  isValidAlias,
  isValidName,
  isValidSettingList,
  pickValidator,
  registerSchemaStack,
} from '../utils';
import { NodeSymbol, SchemaSymbol } from '../../symbol/symbols';
import {
  createIdFromContext,
  createSubfieldId,
  createSubfieldSymbol,
  createSymbolFromContext,
} from '../../symbol/utils';
import SymbolFactory from '../../symbol/factory';
import { getSubfieldKind, isCustomElement } from './utils';

export default abstract class ElementValidator {
  protected abstract elementKind: ElementKind;

  protected abstract context: ContextValidatorConfig;
  protected abstract unique: UniqueElementValidatorConfig;
  protected abstract name: NameValidatorConfig;
  protected abstract alias: AliasValidatorConfig;
  protected abstract body: BodyValidatorConfig;
  protected abstract settingList: SettingListValidatorConfig;
  protected abstract subfield: SubFieldValidatorConfig;

  protected declarationNode: ElementDeclarationNode;
  protected publicSchemaSymbol: SchemaSymbol;
  protected contextStack: ContextStack;
  protected unresolvedNames: UnresolvedName[];
  protected errors: CompileError[];
  protected kindsGloballyFound: Set<ElementKind>;
  protected kindsLocallyFound: Set<ElementKind>;
  protected symbolFactory: SymbolFactory;

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
    this.declarationNode = declarationNode;
    this.publicSchemaSymbol = publicSchemaSymbol;
    this.contextStack = contextStack;
    this.unresolvedNames = unresolvedNames;
    this.errors = errors;
    this.kindsGloballyFound = kindsGloballyFound;
    this.kindsLocallyFound = kindsLocallyFound;
    this.symbolFactory = symbolFactory;
  }

  validate(): boolean {
    this.contextStack.push(this.context.name);
    const res =
      this.validateContext() &&
      this.validateUnique() &&
      this.validateName() &&
      this.validateAlias() &&
      this.validateSettingList() &&
      this.validateBodyForm() &&
      this.validateBodyContent();

    this.contextStack.pop();

    return res;
  }

  /* Validate uniqueness according to config `this.unique` */

  private validateUnique(): boolean {
    return (
      (this.validateGloballyUnique() && this.validateLocallyUnique()) || !this.unique.stopOnError
    );
  }

  private validateLocallyUnique(): boolean {
    if (!this.unique.locally) {
      return true;
    }

    if (this.kindsLocallyFound.has(this.elementKind)) {
      this.logError(
        this.declarationNode.type,
        this.unique.notLocallyErrorCode,
        `A(n) ${this.elementKind} has already been defined in this scope`,
      );

      return false;
    }

    this.kindsLocallyFound.add(this.elementKind);

    return true;
  }

  private validateGloballyUnique(): boolean {
    if (!this.unique.globally) {
      return true;
    }

    if (this.kindsGloballyFound.has(this.elementKind)) {
      this.logError(
        this.declarationNode.type,
        this.unique.notGloballyErrorCode,
        `A(n) ${this.elementKind} has already been defined in this file`,
      );

      return false;
    }

    this.kindsGloballyFound.add(this.elementKind);

    return true;
  }

  /* Validate context according to config `this.context` */

  private validateContext(): boolean {
    if (!canBeNestedWithin(this.contextStack.parent(), this.contextStack.top())) {
      this.logError(
        this.declarationNode.type,
        this.context.errorCode,
        isCustomElement(this.elementKind) ?
          'Unknown element type' :
          `A(n) ${this.elementKind} can not appear here`,
      );

      return !this.context.stopOnError;
    }

    return true;
  }

  /* Validate and register name according to config `this.name` */

  private validateName(): boolean {
    // Default symbol in case one of the check fails which cause registerName to not be called
    this.declarationNode.symbol = createSymbolFromContext(
      this.declarationNode,
      this.context.name,
      this.symbolFactory,
    );

    return (
      (this.checkNameInValidForm() &&
        this.checkNameAllowed() &&
        this.checkNameOptional() &&
        this.checkNameComplex() &&
        // Short-circuting prevents registerName to be called if a previous check fails
        this.registerName()) ||
      !this.name.stopOnError
    );
  }

  private checkNameInValidForm(): boolean {
    const { name } = this.declarationNode;
    if (name && !isValidName(name)) {
      this.logError(name, CompileErrorCode.INVALID_NAME, 'Invalid element name');

      return false;
    }

    return true;
  }

  private checkNameAllowed(): boolean {
    if (!this.name.allow && this.declarationNode.name) {
      this.logError(
        this.declarationNode.name,
        this.name.notAllowErrorCode,
        `A(n) ${this.elementKind} shouldn't have a name`,
      );

      return false;
    }

    return true;
  }

  private checkNameOptional(): boolean {
    if (!this.name.optional && !this.declarationNode.name) {
      this.logError(
        this.declarationNode.type,
        this.name.notOptionalErrorCode,
        `A(n) ${this.elementKind} must have a name`,
      );

      return false;
    }

    return true;
  }

  private checkNameComplex(): boolean {
    const { name } = this.declarationNode;
    if (!this.name.allowComplex && name && !isSimpleName(name)) {
      this.logError(
        name,
        this.name.complexErrorCode,
        `A(n) ${this.elementKind} must have a double-quoted string or an identifier name`,
      );

      return false;
    }

    return true;
  }

  private registerName(): boolean {
    if (this.declarationNode.name && this.name.shouldRegister) {
      const { registeredSymbol, ok } = this.registerElement(this.declarationNode.name);
      this.declarationNode.symbol = registeredSymbol;

      return ok;
    }

    return true;
  }

  /* Validate and register alias according to config `this.alias` */

  private validateAlias(): boolean {
    return (
      (this.checkAliasInValidForm() &&
        this.checkAliasAllow() &&
        this.checkAliasOptional() &&
        // Short-circuting prevents registerAlias to be called if a previous check fails
        this.registerAlias()) ||
      !this.alias.stopOnError
    );
  }

  private checkAliasInValidForm() {
    const { alias } = this.declarationNode;
    if (alias && !isValidAlias(alias)) {
      this.logError(alias, CompileErrorCode.INVALID_ALIAS, 'Invalid element alias');

      return false;
    }

    return true;
  }

  private checkAliasAllow(): boolean {
    const { alias } = this.declarationNode;

    if (!this.alias.allow && alias) {
      this.logError(
        alias,
        this.alias.notAllowErrorCode,
        `A(n) ${this.elementKind} shouldn't have an alias`,
      );

      return false;
    }

    return true;
  }

  private checkAliasOptional(): boolean {
    const { alias } = this.declarationNode;

    if (!this.alias.optional && !alias) {
      this.logError(
        this.declarationNode.type,
        this.alias.notOptionalErrorCode,
        `A(n) ${this.elementKind} must have an alias`,
      );

      return false;
    }

    return true;
  }

  private registerAlias(): boolean {
    const { alias } = this.declarationNode;
    if (alias && this.name.shouldRegister) {
      const { ok } = this.registerElement(alias, this.declarationNode.symbol);

      return ok;
    }

    return true;
  }

  // Register a name extracted from `nameNode` into the `public` schema
  // Also check for duplicated name
  // If `defaultSymbol` is undefined, create the symbol anew corresponding to the name
  // If `defaultSymbol` is given, the symbol (and its symbol table) is reused
  private registerElement(
    nameNode: SyntaxNode,
    defaultSymbol?: NodeSymbol,
  ): { registeredSymbol: NodeSymbol; ok: boolean } {
    const variables = destructureComplexVariable(nameNode).unwrap_or(undefined);
    if (!variables) {
      throw new Error(`${this.elementKind} must be a valid complex variable`);
    }
    const name = variables.pop();
    if (!name) {
      throw new Error(`${this.elementKind} name shouldn't be empty`);
    }

    const id = createIdFromContext(name, this.context.name);

    if (variables[0] === 'public') {
      variables.shift();
    }

    const registerSchema = registerSchemaStack(
      variables,
      this.publicSchemaSymbol.symbolTable,
      this.symbolFactory,
    );
    if (!id) {
      throw new Error(`${this.elementKind} fails to create id to register in the symbol table`);
    }

    const newSymbol = createSymbolFromContext(
      this.declarationNode,
      this.context.name,
      this.symbolFactory,
    );
    if (!newSymbol) {
      throw new Error(
        `${this.elementKind} fails to create a symbol to register in the symbol table`,
      );
    }

    if (registerSchema.has(id)) {
      this.logError(
        nameNode,
        this.name.duplicateErrorCode,
        `${this.elementKind} "${name}" has been defined`,
      );

      return { registeredSymbol: defaultSymbol || newSymbol, ok: false };
    }
    registerSchema.set(id, defaultSymbol || newSymbol);

    return { registeredSymbol: defaultSymbol || newSymbol, ok: true };
  }

  /* Validate element according to config `this.settingList` */

  private validateSettingList(): boolean {
    return (
      (this.checkSettingListInValidForm() &&
        this.checkSettingListAllow() &&
        this.checkSettingListOptional() &&
        (!this.declarationNode.attributeList ||
          this.validateSettingListContent(this.declarationNode.attributeList, this.settingList))) ||
      !this.settingList.stopOnError
    );
  }

  private checkSettingListInValidForm(): boolean {
    const { attributeList } = this.declarationNode;
    if (attributeList && !isValidSettingList(attributeList)) {
      this.logError(attributeList, CompileErrorCode.INVALID_SETTINGS, 'SettingList must be a list');

      return false;
    }

    return true;
  }

  private checkSettingListAllow(): boolean {
    const { attributeList } = this.declarationNode;
    if (!this.settingList.allow && attributeList) {
      this.logError(
        attributeList,
        this.settingList.notAllowErrorCode,
        `A(n) ${this.elementKind} shouldn't have a setting list`,
      );

      return false;
    }

    return true;
  }

  private checkSettingListOptional(): boolean {
    const { attributeList } = this.declarationNode;
    if (!this.settingList.optional && !attributeList) {
      this.logError(
        this.declarationNode.type,
        this.settingList.notOptionalErrorCode,
        `A(n) ${this.elementKind} must have a setting list`,
      );

      return false;
    }

    return true;
  }

  /* Validate body format according to config `this.body` */

  private validateBodyForm(): boolean {
    let hasError = false;
    const node = this.declarationNode;

    if (!this.body.allowComplex && hasComplexBody(node)) {
      this.logError(
        node.body,
        this.body.complexErrorCode,
        `A(n) ${this.elementKind} should not have a complex body`,
      );
      hasError = true;
    }

    if (!this.body.allowSimple && hasSimpleBody(node)) {
      this.logError(
        node.body,
        this.body.simpleErrorCode,
        `A(n) ${this.elementKind} should not have a simple body`,
      );
      hasError = true;
    }

    return !hasError || !this.body.stopOnError;
  }

  /* Validate the body content */

  protected validateBodyContent(): boolean {
    const node = this.declarationNode;

    if (hasComplexBody(node)) {
      if (!this.body.allowComplex) {
        return false;
      }

      const kindsFoundInScope = new Set<ElementKind>();
      let hasError = false;
      let ith = -1;
      hasError =
        !node.body.body
          .map((sub) => {
            if (sub instanceof ElementDeclarationNode) {
              return this.validateNestedElementDeclaration(sub, kindsFoundInScope);
            }
            ith += 1;
            if (sub instanceof FunctionApplicationNode) {
              return this.validateSubField(sub, ith);
            }

            return this.validateSubField(sub, ith);
          })
          .every((v) => !!v === true) || hasError;

      return !hasError;
    }

    if (node.body instanceof FunctionApplicationNode) {
      return this.validateSubField(node.body, 0);
    }

    return this.validateSubField(node.body, 0);
  }

  protected validateNestedElementDeclaration(
    sub: ElementDeclarationNode,
    kindsFoundInScope: Set<ElementKind>,
  ): boolean {
    // eslint-disable-next-line no-param-reassign
    sub.parentElement = this.declarationNode;

    const Val = pickValidator(sub);

    const validatorObject = new Val(
      sub,
      this.publicSchemaSymbol,
      this.contextStack,
      this.unresolvedNames,
      this.errors,
      this.kindsGloballyFound,
      kindsFoundInScope,
      this.symbolFactory,
    );

    return validatorObject.validate();
  }

  /* Validate and register subfield according to config `this.subfield` */

  protected validateSubField(sub: ExpressionNode, ith: number): boolean {
    const args = sub instanceof FunctionApplicationNode ? [sub.callee, ...sub.args] : [sub];
    if (args.length === 0) {
      throw new Error('A function application node always has at least 1 callee');
    }

    const maybeSettingList = args[args.length - 1];
    this.validateSubFieldSettingList(maybeSettingList);
    if (maybeSettingList instanceof ListExpressionNode) {
      args.pop();
    }

    if (args.length !== this.subfield.argValidators.length) {
      this.logError(
        sub,
        this.subfield.invalidArgNumberErrorCode,
        this.subfield.invalidArgNumberErrorMessage!,
      );

      return false;
    }

    let hasError = false;

    for (let i = 0; i < args.length; i += 1) {
      const errors = this.subfield.argValidators[i].validateArg(args[i], ith);
      if (errors.length > 0) {
        this.errors.push(...errors);
        hasError = true;
      } else {
        this.subfield.argValidators[i].registerUnresolvedName?.call(
          undefined,
          args[i],
          this.declarationNode,
          this.unresolvedNames,
        );
      }
    }

    if (this.subfield.shouldRegister && !hasError) {
      const symbol = this.registerSubField(sub, args[0]).unwrap_or(undefined);
      hasError = symbol === undefined || hasError;
      // eslint-disable-next-line no-param-reassign
      sub.symbol = symbol;
    }

    return !hasError;
  }

  private registerSubField(declarationNode: SyntaxNode, nameNode: SyntaxNode): Option<NodeSymbol> {
    if (!this.declarationNode.symbol || !this.declarationNode.symbol.symbolTable) {
      throw new Error('If an element allows registering subfields, it must own a symbol table');
    }

    if (!isSimpleName(nameNode)) {
      throw new Error('If an element allows registering subfields, their name must be simple');
    }
    const name = extractVariableNode(nameNode).unwrap().value;
    const { symbolTable } = this.declarationNode.symbol;
    if (!name) {
      throw new Error(`${this.elementKind} subfield's name shouldn't be empty`);
    }

    const id = createSubfieldId(name, this.context.name);
    if (!id) {
      throw new Error(
        `${this.elementKind} fails to create subfield id to register in the symbol table`,
      );
    }
    if (symbolTable.has(id)) {
      this.logError(
        nameNode,
        this.subfield.duplicateErrorCode,
        `${this.elementKind} ${getSubfieldKind(this.elementKind)} "${name}" has been defined`,
      );

      return new None();
    }
    const symbol = createSubfieldSymbol(declarationNode, this.context.name, this.symbolFactory);
    if (!symbol) {
      throw new Error(
        `${this.elementKind} fails to create subfield symbol to register in the symbol table`,
      );
    }

    return new Some(symbolTable.get(id, symbol));
  }

  protected validateSubFieldSettingList(maybeSettingList: ExpressionNode): boolean {
    if (!(maybeSettingList instanceof ListExpressionNode) && !this.subfield.settingList.optional) {
      this.logError(
        maybeSettingList,
        this.subfield.settingList.notOptionalErrorCode,
        `A(n) ${this.elementKind} ${getSubfieldKind(this.elementKind)} must have a setting list`,
      );

      return false;
    }

    if (maybeSettingList instanceof ListExpressionNode && !this.subfield.settingList.allow) {
      this.logError(
        maybeSettingList,
        this.subfield.settingList.notAllowErrorCode,
        `A(n) ${this.elementKind} ${getSubfieldKind(
          this.elementKind,
        )}  should not have a setting list`,
      );

      return false;
    }

    if (!(maybeSettingList instanceof ListExpressionNode)) {
      return true;
    }

    return this.validateSettingListContent(maybeSettingList, this.subfield.settingList);
  }

  private validateSettingListContent(
    settingListNode: ListExpressionNode,
    config: SettingListValidatorConfig,
  ): boolean {
    const settingListSet = new Set<string>();
    let hasError = false;
    // eslint-disable-next-line no-restricted-syntax
    for (const setting of settingListNode.elementList) {
      const name = extractStringFromIdentifierStream(setting.name).toLowerCase();
      const { value } = setting;

      if (!config.isValid(name, value).isOk()) {
        this.logError(setting, config.unknownErrorCode, 'Unknown setting');
        hasError = true;
      } else if (settingListSet.has(name) && !config.allowDuplicate(name).unwrap()) {
        this.logError(setting, config.duplicateErrorCode, 'Duplicate setting');
        hasError = true;
      } else {
        settingListSet.add(name);
        if (!config.isValid(name, value).unwrap()) {
          this.logError(setting, config.invalidErrorCode, 'Invalid value for this setting');
          hasError = true;
        } else {
          config.registerUnresolvedName(name, value, this.declarationNode, this.unresolvedNames);
        }
      }
    }

    return !hasError;
  }

  protected logError(
    nodeOrToken: SyntaxNode | SyntaxToken,
    code: CompileErrorCode | undefined,
    message: string,
  ) {
    if (code === undefined) {
      throw Error(`This error shouldn't exist. Maybe a validator is misconfigured
       Error message: ${message}`);
    }
    // eslint-disable-next-line no-unused-expressions
    this.errors.push(new CompileError(code, message, nodeOrToken));
  }
}
