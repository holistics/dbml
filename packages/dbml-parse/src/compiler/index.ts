import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathKey } from './projectLayout';
import { DEFAULT_ENTRY } from './constants';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, parseProject, localSymbolTable, analyzeProject, interpretProject } from './queries/pipeline';
import { flatStream, invalidStream } from './queries/token';
import { nodeSymbol, nodeReferences, nodeReferee, symbolOfName, symbolOfNameToKey, symbolMembers } from './queries/symbol';
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
  // Signature: (filepath: Filepath) => FileParseIndex
  parseFile = this.localQuery(parseFile);

  // A local query
  // Validate a single file, producing its symbol table and external filepath references
  // Signature: (filepath?: Filepath) => Report<FileLocalSymbolIndex>
  localSymbolTable = this.localQuery(localSymbolTable);

  // A global query
  // Parse every .dbml file in the project layout
  // Signature: () => Map<FilepathKey, FileParseIndex>
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
    ofName: this.globalQuery(symbolOfName, symbolOfNameToKey),
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
