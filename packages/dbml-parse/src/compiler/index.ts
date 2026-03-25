import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathId } from './projectLayout';
import { intern, Internable, Primitive } from '@/core/internable';
import { DEFAULT_ENTRY } from './constants';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, validateFile, localSymbolTable, localFileDependencies, resolvedSymbolTable, resolvedSymbol, bindFile, interpretFile } from './queries/pipeline';
import { flatStream, invalidStream } from './queries/token';
import { nodeSymbol, nodeReferences, nodeReferee, symbolOfName, symbolMembers } from './queries/symbol';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
import { fileErrors, fileWarnings, projectErrors, projectWarnings } from './queries/diagnostics';
import {
  renameTable,
  type TextEdit,
  type TableNameInput,
} from './queries/transform';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';

export { ScopeKind } from './types';
export type { TextEdit, TableNameInput };
export type { FileParseIndex } from './queries/pipeline';
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

export default class Compiler {
  private _layout: DbmlProjectLayout;

  // A map holding cached results for all globalQuery-wrapped functions.
  // Each entry corresponds to one query, keyed by a unique Symbol assigned at registration time.
  // Cleared entirely whenever any file is added, changed, or deleted,
  // because global queries may depend on any combination of files.
  private globalQueryCache = new Map<symbol, any>();

  // A map holding per-file caches for all localQuery-wrapped functions.
  // Each entry corresponds to one query, keyed by a unique Symbol assigned at registration time.
  // The value is a Map<FilepathId, result> - when a file changes, only that file's entry is
  // deleted from each sub-map; when all files are cleared, every sub-map is fully cleared.
  private localQueryCache = new Map<symbol, any>();

  constructor (layout?: DbmlProjectLayout) {
    this._layout = layout ?? new MemoryProjectLayout();
  }

  setSource (source: string, filePath?: Filepath): this {
    if (filePath === undefined) {
      // No filepath - reset to a clean single-file layout
      this._layout = new MemoryProjectLayout({ [DEFAULT_ENTRY.intern()]: source });
    } else {
      this._layout.setSource(filePath, source);
    }

    this.globalQueryCache.clear();
    if (filePath === undefined) {
      this.localQueryCache.forEach((c) => c.clear());
    } else {
      this.localQueryCache.forEach((c) => c.delete(filePath.intern()));
    }
    return this;
  }

  // Memoize a function that operates on a single file.
  //
  // Each wrapped function gets its own cache (Map<FilepathId, T>).
  // When a file changes, only that file's entry is removed from every local cache (see setSource/deleteSource).
  //
  // Usage:  parseFile = this.localQuery(parseFile);
  //         this.parseFile(filepath)  // first call computes, subsequent calls return cached result
  private localQuery<T> (fn: (this: Compiler, filepath: Filepath) => T): (filepath: Filepath) => T {
    const cacheKey = Symbol(); // unique identifier for this particular query in localQueryCache
    const cache = new Map<FilepathId, T>();
    this.localQueryCache.set(cacheKey, cache); // register so setSource/deleteSource can invalidate entries
    return (filepath: Filepath): T => {
      const fileId = filepath.intern();
      if (cache.has(fileId)) return cache.get(fileId)!;
      const result = fn.call(this, filepath);
      cache.set(fileId, result);
      return result;
    };
  }

  // Memoize a function that may depend on multiple files (e.g. cross-file symbol resolution).
  //
  // Unlike localQuery, we can't know which files affect the result,
  // so the entire global cache is cleared whenever ANY file changes (see setSource/deleteSource).
  //
  // Each wrapped function is assigned a unique Symbol as its key in globalQueryCache.
  // - No-arg queries:  globalQueryCache stores the result directly     (Symbol -> Return)
  // - With-arg queries: globalQueryCache stores a sub-map of results   (Symbol -> Map<string, Return>)
  //   The sub-map key is built by serializing all args via intern() joined with '\0'.
  //
  // Usage:  errors = this.globalQuery(errors);           // no-arg
  //         nodeSymbol = this.globalQuery(nodeSymbol);    // with-arg
  private globalQuery<Args extends (Primitive | Primitive[] | Internable<unknown>)[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const cacheKey = Symbol();
    return ((...args: Args): Return => {
      const argKey = args.map((a) => intern(a)).join('\0');
      let subCache = this.globalQueryCache.get(cacheKey);
      if (subCache instanceof Map && subCache.has(argKey)) return subCache.get(argKey);

      const result = fn.apply(this, args);
      if (!(subCache instanceof Map)) {
        subCache = new Map();
        this.globalQueryCache.set(cacheKey, subCache);
      }
      subCache.set(argKey, result);
      return result;
    }) as (...args: Args) => Return;
  }

  deleteSource (filePath: Filepath): this {
    this._layout.deleteSource(filePath);
    this.globalQueryCache.clear();
    this.localQueryCache.forEach((c) => c.delete(filePath.intern()));
    return this;
  }

  clearSource (): this {
    this._layout.clearSource();
    this.globalQueryCache.clear();
    this.localQueryCache.forEach((c) => c.clear());
    return this;
  }

  layout (): Readonly<DbmlProjectLayout> {
    return this._layout;
  }

  ast (filePath: Filepath) {
    return this.parseFile(filePath).ast;
  }

  getSource (filePath: Filepath): string | undefined {
    return this._layout.getSource(filePath);
  }

  renameTable (
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, oldName, newName, DEFAULT_ENTRY);
  }

  /* pipeline */

  // A local query
  // Lex and parse a single file into its AST, token list, errors, and warnings
  // Signature: (filepath: Filepath) => FileParseIndex
  parseFile = this.localQuery(parseFile);

  // A local query
  // Validate a single file, producing its LOCAL symbol table and external filepath references.
  // WARNING: The symbolTable in the result contains unresolved ExternalSymbols.
  // Most consumers should use bindFile instead.
  // Signature: (filepath?: Filepath) => FileLocalSymbolIndex
  validateFile = this.localQuery(validateFile);

  // A local query
  // The LOCAL symbol table for a single file (after validation).
  // WARNING: Contains unresolved ExternalSymbols - use resolvedSymbolTable for resolved lookups.
  // Signature: (filepath?: Filepath) => Readonly<SymbolTable>
  localSymbolTable = this.localQuery(localSymbolTable);

  // A local query
  // External filepaths referenced by use declarations in a single file
  // Signature: (filepath?: Filepath) => ReadonlyMap<FilepathId, UseDeclarationNode>
  localFileDependencies = this.localQuery(localFileDependencies);

  // A global query - resolve external symbols, producing a resolved symbol table.
  resolvedSymbolTable = this.globalQuery(resolvedSymbolTable);

  // A global query - resolve a single node's symbol (replacing ExternalSymbol with the real one).
  resolvedSymbol = this.globalQuery(resolvedSymbol);

  // A global query - resolve + bind a file, producing symbolTable, nodeToSymbol, nodeToReferee, symbolToReferences.
  bindFile = this.globalQuery(bindFile);

  // A global query - interpret a file and its dependency graph into a Model (one Database per file).
  // Global because it depends on bindFile (a global query for cross-file resolution).
  // Signature: (filepath?: Filepath) => Report<Model>
  interpretFile = this.globalQuery(interpretFile);

  /* diagnostics */

  // A global query - errors for a single file (after resolution + binding)
  fileErrors = this.globalQuery(fileErrors);

  // A global query - warnings for a single file (after resolution + binding)
  fileWarnings = this.globalQuery(fileWarnings);

  // A global query - errors aggregated across all files in the project
  projectErrors = this.globalQuery(projectErrors);

  // A global query - warnings aggregated across all files in the project
  projectWarnings = this.globalQuery(projectWarnings);

  readonly token = {
    flatStream: this.localQuery(flatStream),
    invalidStream: this.localQuery(invalidStream),
  };

  readonly symbol = {
    nodeSymbol: this.globalQuery(nodeSymbol),
    nodeReferences: this.globalQuery(nodeReferences),
    nodeReferee: this.globalQuery(nodeReferee),
    ofName: this.globalQuery(symbolOfName),
    members: this.globalQuery(symbolMembers),
  };

  readonly container = {
    stack: this.globalQuery(containerStack),
    token: this.globalQuery(containerToken),
    element: this.globalQuery(containerElement),
    scope: this.globalQuery(containerScope),
    scopeKind: this.globalQuery(containerScopeKind),
  };

  /** @deprecated Use parseFile/fileErrors/fileWarnings/interpretFile with explicit filepath instead. */
  readonly parse = {
    /** @deprecated Use `compiler.getSource(filepath)` */
    source: () => this.getSource(DEFAULT_ENTRY) ?? '',
    /** @deprecated Use `compiler.parseFile(filepath).ast` */
    ast: () => this.parseFile(DEFAULT_ENTRY).ast,
    /** @deprecated Use `compiler.fileErrors(filepath)` */
    errors: () => this.fileErrors(DEFAULT_ENTRY),
    /** @deprecated Use `compiler.fileWarnings(filepath)` */
    warnings: () => this.fileWarnings(DEFAULT_ENTRY),
    /** @deprecated Use `compiler.parseFile(filepath).tokens` */
    tokens: () => this.parseFile(DEFAULT_ENTRY).tokens,
    /** @deprecated Use `compiler.interpretFile(filepath).getValue().databases[0]` */
    rawDb: () => this.interpretFile(DEFAULT_ENTRY).getValue().databases[0],
  };

  initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
    };
  }
}
