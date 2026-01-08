import { CACHE_STORAGE, CacheStorage, createCacheStorage, clearCache, query } from './query';
import { ScopeKind } from './types';
import { SyntaxNodeIdGenerator, ProgramNode, ElementDeclarationNode, SyntaxNode } from '@/core/parser/nodes';
import { NodeSymbolIdGenerator, NodeSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { CompileError } from '@/core/errors';
import { Database } from '@/core/interpreter/types';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider } from '@/services/index';

// Import query implementations
import { ast, errors, tokens, rawDb, publicSymbolTable } from './queries/parse';
import { invalidStream, flatStream } from './queries/token';
import { symbolOfName, symbolOfNameToKey, symbolMembers } from './queries/symbol';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
import { renameTable, applyTextEdits, type TextEdit } from './queries/transform';

import Report from '@/core/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Analyzer from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';

// Re-export types
export { ScopeKind } from './types';

export default class Compiler {
  private source = '';
  private [CACHE_STORAGE]: CacheStorage = createCacheStorage();

  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  setSource (source: string) {
    this.source = source;
    clearCache(this[CACHE_STORAGE]);
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();
  }

  // Parse namespace queries
  @query()
  private _parseInterpret () {
    const parseRes = new Lexer(this.source)
      .lex()
      .chain((lexedTokens) => new Parser(lexedTokens as SyntaxToken[], this.nodeIdGenerator).parse())
      .chain(({ ast, tokens }) => new Analyzer(ast, this.symbolIdGenerator).analyze().map(() => ({ ast, tokens })));

    if (parseRes.getErrors().length > 0) {
      return parseRes as Report<{ ast: ProgramNode; tokens: SyntaxToken[]; rawDb?: Database }, CompileError>;
    }

    return parseRes.chain(({ ast, tokens }) =>
      new Interpreter(ast).interpret().map((rawDb) => ({ ast, tokens, rawDb })),
    );
  }

  @query()
  private _parseAst (): Readonly<ProgramNode> {
    return ast.call(this);
  }

  @query()
  private _parseErrors (): readonly Readonly<CompileError>[] {
    return errors.call(this);
  }

  @query()
  private _parseTokens (): Readonly<SyntaxToken>[] {
    return tokens.call(this);
  }

  @query()
  private _parseRawDb (): Readonly<Database> | undefined {
    return rawDb.call(this);
  }

  @query()
  private _parsePublicSymbolTable (): Readonly<SymbolTable> {
    return publicSymbolTable.call(this);
  }

  // Token namespace queries
  @query()
  private _tokenInvalidStream (): readonly SyntaxToken[] {
    return invalidStream.call(this);
  }

  @query()
  private _tokenFlatStream (): readonly SyntaxToken[] {
    return flatStream.call(this);
  }

  // Container namespace queries
  @query()
  private _containerStack (offset: number): readonly Readonly<SyntaxNode>[] {
    return containerStack.call(this, offset);
  }

  @query()
  private _containerToken (offset: number): { token: SyntaxToken; index: number } | { token: undefined; index: undefined } {
    return containerToken.call(this, offset);
  }

  @query()
  private _containerElement (offset: number): Readonly<ElementDeclarationNode | ProgramNode> {
    return containerElement.call(this, offset);
  }

  @query()
  private _containerScope (offset: number): Readonly<SymbolTable> | undefined {
    return containerScope.call(this, offset);
  }

  @query()
  private _containerScopeKind (offset: number): ScopeKind {
    return containerScopeKind.call(this, offset);
  }

  // Symbol namespace queries
  @query({ toKey: symbolOfNameToKey })
  private _symbolOfName (nameStack: string[], owner: ElementDeclarationNode | ProgramNode) {
    return symbolOfName.call(this, nameStack, owner);
  }

  @query()
  private _symbolMembers (ownerSymbol: NodeSymbol) {
    return symbolMembers.call(this, ownerSymbol);
  }

  renameTable (oldName: string, newName: string): string {
    return renameTable.call(this, oldName, newName);
  }

  applyTextEdits (edits: TextEdit[]): string {
    return applyTextEdits(this.parse.source(), edits);
  }

  // Namespace objects
  readonly token = {
    invalidStream: this._tokenInvalidStream,
    flatStream: this._tokenFlatStream,
  };

  readonly parse = {
    source: () => this.source as Readonly<string>,
    _: this._parseInterpret,
    ast: this._parseAst,
    errors: this._parseErrors,
    tokens: this._parseTokens,
    rawDb: this._parseRawDb,
    publicSymbolTable: this._parsePublicSymbolTable,
  };

  readonly container = {
    stack: this._containerStack,
    token: this._containerToken,
    element: this._containerElement,
    scope: this._containerScope,
    scopeKind: this._containerScopeKind,
  };

  readonly symbol = {
    ofName: this._symbolOfName,
    members: this._symbolMembers,
  };

  initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
    };
  }
}
