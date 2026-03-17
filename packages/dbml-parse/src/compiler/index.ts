import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathKey } from './projectLayout';
import { DEFAULT_ENTRY } from './constants';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, parseProject, analyzeProject, interpretProject, modules } from './queries/pipeline';
import { flatTokenStream, invalidTokens } from './queries/token';
import { nodeSymbol, nodeReferences, nodeReferee, symbolOfName, symbolOfNameToKey, symbolMembers } from './queries/symbol';
import { stackAtOffset, tokenAtOffset, elementAtOffset, scopeAtOffset, scopeKindAtOffset } from './queries/offset';
import { errors, warnings } from './queries/diagnostics';
import {
  renameTable,
  type TextEdit,
  type TableNameInput,
} from './queries/transform';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';

// Re-export types
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput };
export type { FileIndex } from './queries/pipeline';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

export default class Compiler {
  private _layout: DbmlProjectLayout;
  private globalCache = new Map<symbol, any>();
  private localCaches: Map<FilepathKey, unknown>[] = [];
  constructor (layout?: DbmlProjectLayout) {
    this._layout = layout ?? new MemoryProjectLayout();
  }

  setSource (source: string, filePath?: Filepath): this {
    if (filePath === undefined) {
      // No filepath - reset to a clean single-file layout
      this._layout = new MemoryProjectLayout({ [DEFAULT_ENTRY.key]: source });
    } else {
      this._layout.setSource(filePath, source);
    }

    this.globalCache.clear();
    if (filePath === undefined) {
      this.localCaches.forEach((c) => c.clear());
    } else {
      this.localCaches.forEach((c) => c.delete(filePath.key));
    }
    return this;
  }

  private localQuery<T> (fn: (this: Compiler, filepath: Filepath) => T): (filepath?: Filepath) => T {
    const cache = new Map<FilepathKey, T>();
    this.localCaches.push(cache as Map<FilepathKey, unknown>);
    return (filepath: Filepath = DEFAULT_ENTRY): T => {
      const cached = cache.get(filepath.key);
      if (cached !== undefined) return cached;
      const result = fn.call(this, filepath);
      cache.set(filepath.key, result);
      return result;
    };
  }

  private globalQuery<Args extends unknown[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
    toKey?: (...args: Args) => unknown,
  ): (...args: Args) => Return {
    const cacheKey = Symbol();
    return ((...args: Args): Return => {
      if (args.length === 0) {
        if (this.globalCache.has(cacheKey)) return this.globalCache.get(cacheKey);
        const result = fn.apply(this, args);
        this.globalCache.set(cacheKey, result);
        return result;
      }

      const key = toKey ? toKey(...args) : args[0];
      let mapCache = this.globalCache.get(cacheKey);
      if (mapCache instanceof Map && mapCache.has(key)) return mapCache.get(key);

      const result = fn.apply(this, args);
      if (!(mapCache instanceof Map)) {
        mapCache = new Map();
        this.globalCache.set(cacheKey, mapCache);
      }
      mapCache.set(key, result);
      return result;
    }) as (...args: Args) => Return;
  }

  deleteSource (filePath: Filepath): this {
    this._layout.deleteSource(filePath);
    this.globalCache.clear();
    this.localCaches.forEach((c) => c.delete(filePath.key));
    return this;
  }

  clearSource (): this {
    this._layout.clearSource();
    this.globalCache.clear();
    this.localCaches.forEach((c) => c.clear());
    return this;
  }

  layout (): Readonly<DbmlProjectLayout> {
    return this._layout;
  }

  ast (filePath: Filepath = DEFAULT_ENTRY) {
    return this.parseFile(filePath).ast;
  }

  getSource (filePath: Filepath = DEFAULT_ENTRY): string | undefined {
    return this._layout.getSource(filePath);
  }

  renameTable (
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, oldName, newName);
  }

  /* pipeline */

  // A local query
  // Lex and parse a single file into its AST, token list, errors, and warnings
  // Signature: (filepath: Filepath) => FileIndex
  parseFile = this.localQuery(parseFile);

  // A global query
  // Parse every .dbml file in the project layout
  // Signature: () => Map<FilepathKey, FileIndex>
  parseProject = this.globalQuery(parseProject);

  // A global query
  // Validate and bind all parsed files, producing a single shared AnalyzeResult;
  // errors from all files are collected in the returned Report
  // Signature: () => Report<AnalyzeResult>
  analyzeProject = this.globalQuery(analyzeProject);

  // A global query
  // Interpret the analyzed ASTs into a merged Database model
  // Signature: () => Report<Database | undefined>
  interpretProject = this.globalQuery(interpretProject);

  // A global query
  // Detect module boundaries in the project layout.
  // A module is a folder containing a *.project.dbml file; root is always a module.
  // Folders without *.project.dbml are merged into their nearest ancestor module.
  // Signature: () => Module[]
  modules = this.globalQuery(modules);

  /* token */

  // A local query
  // Ordered flat stream of every token in the given file,
  // with leading/trailing invalid tokens interleaved in source order
  // Signature: (filepath?: Filepath) => readonly SyntaxToken[]
  flatTokenStream = this.localQuery(flatTokenStream);

  // A local query
  // All tokens that failed to lex in the given file
  // Signature: (filepath?: Filepath) => readonly SyntaxToken[]
  invalidTokens = this.localQuery(invalidTokens);

  /* symbol */

  // A global query
  // Symbol that declares or owns the given node
  // Signature: (node: SyntaxNode) => NodeSymbol | undefined
  nodeSymbol = this.globalQuery(nodeSymbol);

  // A global query
  // All nodes that reference the same symbol as the given node
  // Signature: (node: SyntaxNode) => SyntaxNode[]
  nodeReferences = this.globalQuery(nodeReferences);

  // A global query
  // Symbol that the given reference node resolves to
  // Signature: (node: SyntaxNode) => NodeSymbol | undefined
  nodeReferee = this.globalQuery(nodeReferee);

  // A global query
  // Resolve a qualified name (e.g. ['public', 'users']) to matching symbols,
  // searching upward from the given scope owner
  // Signature: (nameStack: string[], owner: ElementDeclarationNode | ProgramNode) => { symbol: NodeSymbol; kind: SymbolKind; name: string }[]
  symbolOfName = this.globalQuery(symbolOfName, symbolOfNameToKey);

  // A global query
  // Direct child symbols in the given symbol's symbol table
  // Signature: (symbol: NodeSymbol) => { symbol: NodeSymbol; kind: SymbolKind; name: string }[]
  symbolMembers = this.globalQuery(symbolMembers);

  /* offset */

  // A global query
  // Ancestor chain from ProgramNode down to the innermost node spanning the offset
  // (outermost first, innermost last)
  // Signature: (offset: number) => readonly SyntaxNode[]
  stackAtOffset = this.globalQuery(stackAtOffset);

  // A global query
  // The token immediately before (or containing) the given offset in the flat token stream
  // Signature: (offset: number) => { token: SyntaxToken; index: number } | { token: undefined; index: undefined }
  tokenAtOffset = this.globalQuery(tokenAtOffset);

  // A global query
  // Innermost ElementDeclarationNode containing the offset, or ProgramNode if at top level
  // Signature: (offset: number) => ElementDeclarationNode | ProgramNode
  elementAtOffset = this.globalQuery(elementAtOffset);

  // A global query
  // Symbol table of the innermost scope containing the offset
  // Signature: (offset: number) => SymbolTable | undefined
  scopeAtOffset = this.globalQuery(scopeAtOffset);

  // A global query
  // ScopeKind of the innermost element containing the offset (e.g. TABLE, ENUM, REF, TOPLEVEL)
  // Signature: (offset: number) => ScopeKind
  scopeKindAtOffset = this.globalQuery(scopeKindAtOffset);

  /* diagnostics */

  // A global query
  // All compile errors collected from parsing and analysis
  // Signature: () => readonly CompileError[]
  errors = this.globalQuery(errors);

  // A global query
  // All compile warnings collected from parsing and analysis
  // Signature: () => readonly CompileWarning[]
  warnings = this.globalQuery(warnings);

  initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
    };
  }
}
