import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathId } from './projectLayout';
import { intern } from '@/core/internable';
import { DEFAULT_ENTRY } from './constants';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, parseProject, validateFile, localSymbolTable, localFileDependencies, resolvedSymbolTable, bindFile, bindProject, interpretFile, interpretProject } from './queries/pipeline';
import { flatStream, invalidStream } from './queries/token';
import { nodeSymbol, nodeReferences, nodeReferee, symbolOfName, symbolMembers } from './queries/symbol';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
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
export type { FileParseIndex } from './queries/pipeline';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

export default class Compiler {
  private _layout: DbmlProjectLayout;

  private globalCache = new Map<symbol, any>();
  private localCaches: Map<FilepathId, unknown>[] = [];

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

    this.globalCache.clear();
    if (filePath === undefined) {
      this.localCaches.forEach((c) => c.clear());
    } else {
      this.localCaches.forEach((c) => c.delete(filePath.intern()));
    }
    return this;
  }

  private localQuery<T> (fn: (this: Compiler, filepath: Filepath) => T): (filepath?: Filepath) => T {
    const cache = new Map<FilepathId, T>();
    this.localCaches.push(cache as Map<FilepathId, unknown>);
    return (filepath: Filepath = DEFAULT_ENTRY): T => {
      const id = filepath.intern();
      const cached = cache.get(id);
      if (cached !== undefined) return cached;
      const result = fn.call(this, filepath);
      cache.set(id, result);
      return result;
    };
  }

  private globalQuery<Args extends unknown[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const cacheKey = Symbol();
    return ((...args: Args): Return => {
      if (args.length === 0) {
        if (this.globalCache.has(cacheKey)) return this.globalCache.get(cacheKey);
        const result = fn.apply(this, args);
        return result;
      }

      const key = args.map((a) => intern(a as any)).join('\0');
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
    this.localCaches.forEach((c) => c.delete(filePath.intern()));
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
  // Signature: (filepath: Filepath) => FileParseIndex
  parseFile = this.localQuery(parseFile);

  // A local query
  // Validate a single file, producing its symbol table and external filepath references
  // Signature: (filepath?: Filepath) => FileLocalSymbolIndex
  validateFile = this.localQuery(validateFile);

  // A local query
  // The symbol table for a single file (after validation)
  // Signature: (filepath?: Filepath) => Readonly<SymbolTable>
  localSymbolTable = this.localQuery(localSymbolTable);

  // A local query
  // External filepaths referenced by use declarations in a single file
  // Signature: (filepath?: Filepath) => ReadonlyMap<FilepathId, SyntaxNode>
  localFileDependencies = this.localQuery(localFileDependencies);

  // A global query
  // Resolve external symbols by looking up referenced files' local symbol tables
  // Signature: (filepath: Filepath) => Report<FileResolvedSymbolIndex>
  resolvedSymbolTable = this.globalQuery(resolvedSymbolTable);

  // A local query
  // Bind a single file, producing nodeToReferee
  // Signature: (filepath?: Filepath) => Report<FileBindIndex>
  bindFile = this.localQuery(bindFile);

  // A local query
  // Interpret a single file into a Database model
  // Signature: (filepath?: Filepath) => Report<Database>
  interpretFile = this.localQuery(interpretFile);

  // A global query
  // Parse every .dbml file in the project layout
  // Signature: () => Map<FilepathId, FileParseIndex>
  parseProject = this.globalQuery(parseProject);

  // A global query
  // Bind all parsed files
  // Signature: () => Report<void>
  bindProject = this.globalQuery(bindProject);

  // A global query
  // Interpret all files into a merged Database model
  // Signature: () => Report<Database>
  interpretProject = this.globalQuery(interpretProject);

  /* diagnostics */

  // A global query
  // All compile errors collected from parsing and analysis
  // Signature: () => readonly CompileError[]
  errors = this.globalQuery(errors);

  // A global query
  // All compile warnings collected from parsing and analysis
  // Signature: () => readonly CompileWarning[]
  warnings = this.globalQuery(warnings);

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

  initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
    };
  }
}
