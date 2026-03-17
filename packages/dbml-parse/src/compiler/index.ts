import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathKey } from './projectLayout';
import { type FileIndex } from './types';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, parseProject, analyzeProject, interpretProject, nodeSymbol, nodeReferences, nodeReferee, errors, warnings } from './queries/project';
import { flatTokenStream, invalidTokens } from './queries/token';
import { symbolOfName, symbolOfNameToKey, symbolMembers } from './queries/symbol';
import { stackAtOffset, tokenAtOffset, elementAtOffset, scopeAtOffset, scopeKindAtOffset } from './queries/container';
import {
  renameTable,
  applyTextEdits,
  type TextEdit,
  type TableNameInput,
} from './queries/transform';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';

// Re-export types
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput };
export type { FileIndex } from './types';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

const DEFAULT_ENTRY = Filepath.from('/main.project.dbml');

export default class Compiler {
  private _layout: DbmlProjectLayout;
  private globalCache = new Map<symbol, any>();
  private fileIndexes = new Map<FilepathKey, FileIndex>();
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
      this.fileIndexes.clear();
    } else {
      this.fileIndexes.delete(filePath.key);
    }
    return this;
  }

  private localQuery (fn: (this: Compiler, filepath: Filepath) => FileIndex): (filepath: Filepath) => FileIndex {
    return (filepath: Filepath): FileIndex => {
      const cached = this.fileIndexes.get(filepath.key);
      if (cached) return cached;
      const result = fn.call(this, filepath);
      this.fileIndexes.set(filepath.key, result);
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
    this.fileIndexes.delete(filePath.key);
    return this;
  }

  clearSource (): this {
    this._layout.clearSource();
    this.globalCache.clear();
    this.fileIndexes.clear();
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

  applyTextEdits (edits: TextEdit[]): string {
    // FIXME
    return '';
  }

  parseFile = this.localQuery(parseFile);
  parseProject = this.globalQuery(parseProject);

  analyzeProject = this.globalQuery(analyzeProject);

  interpretProject = this.globalQuery(interpretProject);

  flatTokenStream = this.globalQuery(flatTokenStream);
  invalidTokens = this.globalQuery(invalidTokens);

  nodeSymbol = this.globalQuery(nodeSymbol);
  nodeReferences = this.globalQuery(nodeReferences);
  nodeReferee = this.globalQuery(nodeReferee);

  symbolOfName = this.globalQuery(symbolOfName, symbolOfNameToKey);
  symbolMembers = this.globalQuery(symbolMembers);

  stackAtOffset = this.globalQuery(stackAtOffset);
  tokenAtOffset = this.globalQuery(tokenAtOffset);
  elementAtOffset = this.globalQuery(elementAtOffset);
  scopeAtOffset = this.globalQuery(scopeAtOffset);
  scopeKindAtOffset = this.globalQuery(scopeKindAtOffset);

  errors = this.globalQuery(errors);
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
