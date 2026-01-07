import { CACHE_STORAGE, CacheStorage, createCacheStorage, clearCache, query } from './query';
import { ScopeKind, QueryId } from './types';
import { SyntaxNodeIdGenerator, ProgramNode, ElementDeclarationNode, SyntaxNode } from '@/core/parser/nodes';
import { NodeSymbolIdGenerator, NodeSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { CompileError } from '@/core/errors';
import { Database } from '@/core/interpreter/types';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider } from '@/services/index';

// Import query implementations
import { interpret, type InterpretResult } from './queries/parse/interpret';
import { ast } from './queries/parse/ast';
import { errors } from './queries/parse/errors';
import { tokens } from './queries/parse/tokens';
import { rawDb } from './queries/parse/rawDb';
import { publicSymbolTable } from './queries/parse/publicSymbolTable';

import { invalidStream } from './queries/token/invalidStream';
import { flatStream } from './queries/token/flatStream';

import { stack } from './queries/container/stack';
import { token, type ContainerTokenResult } from './queries/container/token';
import { element } from './queries/container/element';
import { scope } from './queries/container/scope';
import { scopeKind } from './queries/container/scopeKind';

import { ofName, ofNameToKey, type OfNameArg, type OfNameResult } from './queries/symbol/ofName';
import { members, type MembersResult } from './queries/symbol/members';

import { renameTable } from './queries/transform/renameTable';

// Re-export types
export { ScopeKind } from './types';

export default class Compiler {
  source = '';
  [CACHE_STORAGE]: CacheStorage = createCacheStorage();

  nodeIdGenerator = new SyntaxNodeIdGenerator();
  symbolIdGenerator = new NodeSymbolIdGenerator();

  setSource (source: string) {
    this.source = source;
    clearCache(this[CACHE_STORAGE]);
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();
  }

  // Parse namespace queries
  @query(QueryId._Interpret)
  private _interpret (): InterpretResult {
    return interpret.call(this);
  }

  @query(QueryId.Parse_Ast)
  private _ast (): Readonly<ProgramNode> {
    return ast.call(this);
  }

  @query(QueryId.Parse_Errors)
  private _errors (): readonly Readonly<CompileError>[] {
    return errors.call(this);
  }

  @query(QueryId.Parse_Tokens)
  private _tokens (): Readonly<SyntaxToken>[] {
    return tokens.call(this);
  }

  @query(QueryId.Parse_RawDb)
  private _rawDb (): Readonly<Database> | undefined {
    return rawDb.call(this);
  }

  @query(QueryId.Parse_PublicSymbolTable)
  private _publicSymbolTable (): Readonly<SymbolTable> {
    return publicSymbolTable.call(this);
  }

  // Token namespace queries
  @query(QueryId.Token_InvalidStream)
  private _invalidStream (): readonly SyntaxToken[] {
    return invalidStream.call(this);
  }

  @query(QueryId.Token_FlatStream)
  private _flatStream (): readonly SyntaxToken[] {
    return flatStream.call(this);
  }

  // Container namespace queries
  @query(QueryId.Container_Stack)
  private _stack (offset: number): readonly Readonly<SyntaxNode>[] {
    return stack.call(this, offset);
  }

  @query(QueryId.Container_Token)
  private _token (offset: number): ContainerTokenResult {
    return token.call(this, offset);
  }

  @query(QueryId.Container_Element)
  private _element (offset: number): Readonly<ElementDeclarationNode | ProgramNode> {
    return element.call(this, offset);
  }

  @query(QueryId.Container_Scope)
  private _scope (offset: number): Readonly<SymbolTable> | undefined {
    return scope.call(this, offset);
  }

  @query(QueryId.Container_Scope_Kind)
  private _scopeKind (offset: number): ScopeKind {
    return scopeKind.call(this, offset);
  }

  // Symbol namespace queries
  @query(QueryId.Symbol_OfName, { toKey: ofNameToKey })
  private _ofName (arg: OfNameArg): OfNameResult {
    return ofName.call(this, arg);
  }

  @query(QueryId.Symbol_Members)
  private _members (ownerSymbol: NodeSymbol): MembersResult {
    return members.call(this, ownerSymbol);
  }

  renameTable (oldName: string, newName: string): string {
    return renameTable.call(this, oldName, newName);
  }

  // Namespace objects
  readonly token = {
    invalidStream: this._invalidStream,
    flatStream: this._flatStream,
  };

  readonly parse = {
    source: () => this.source as Readonly<string>,
    _: this._interpret,
    ast: this._ast,
    errors: this._errors,
    tokens: this._tokens,
    rawDb: this._rawDb,
    publicSymbolTable: this._publicSymbolTable,
  };

  readonly container = {
    stack: this._stack,
    token: this._token,
    element: this._element,
    scope: this._scope,
    scopeKind: this._scopeKind,
  };

  readonly symbol = {
    ofName: this._ofName,
    members: this._members,
  };

  initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
    };
  }
}
