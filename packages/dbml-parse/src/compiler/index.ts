import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathId } from './projectLayout';
import { intern, Internable, Primitive } from '@/core/internable';
import { DEFAULT_ENTRY } from './constants';
import { type SyntaxNode, SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, localFileDependencies, analyzeFile, analyzeProject, interpretFile, interpretProject } from './queries/pipeline';
import { flatStream, invalidStream } from './queries/token';
import { symbolOfName, symbolMembers } from './queries/symbol';
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

  private globalQueryCache = new Map<symbol, any>();
  private localQueryCache = new Map<symbol, any>();

  readonly nodeIdGenerator = new SyntaxNodeIdGenerator();
  readonly symbolIdGenerator = new NodeSymbolIdGenerator();

  constructor (layout?: DbmlProjectLayout) {
    this._layout = layout ?? new MemoryProjectLayout();
  }

  setSource (source: string, filePath?: Filepath): this {
    if (filePath === undefined) {
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

  private localQuery<T> (fn: (this: Compiler, filepath: Filepath) => T): (filepath: Filepath) => T {
    const cacheKey = Symbol();
    const cache = new Map<FilepathId, T>();
    this.localQueryCache.set(cacheKey, cache);
    return (filepath: Filepath): T => {
      const fileId = filepath.intern();
      if (cache.has(fileId)) return cache.get(fileId)!;
      const result = fn.call(this, filepath);
      cache.set(fileId, result);
      return result;
    };
  }

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
    return this.parseFile(filePath).getValue().ast;
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

  /* pipeline - low-level cached queries, prefer the utility methods below */

  /** @internal */ parseFile = this.localQuery(parseFile);
  /** @internal */ localFileDependencies = this.localQuery(localFileDependencies);
  /** @internal */ analyzeFile = this.globalQuery(analyzeFile);
  /** @internal */ analyzeProject = analyzeProject.bind(this);
  /** @internal */ interpretFile = this.globalQuery(interpretFile);
  /** @internal */ interpretProject = interpretProject.bind(this);

  /* utility queries */

  resolvedSymbol (node: SyntaxNode): NodeSymbol | undefined {
    return this.analyzeFile(node.filepath).getValue().nodeToSymbol.get(node.intern());
  }

  nodeReferee (node: SyntaxNode): NodeSymbol | undefined {
    return this.analyzeFile(node.filepath).getValue().nodeToReferee.get(node.intern());
  }

  nodeReferences (node: SyntaxNode): SyntaxNode[] {
    const symbol = this.resolvedSymbol(node);
    if (!symbol) return [];

    const refs: SyntaxNode[] = [];
    for (const [, report] of this.analyzeProject()) {
      if (report.getErrors().length > 0) continue;
      const fileRefs = report.getValue().symbolToReferences.get(symbol.intern());
      if (fileRefs) refs.push(...fileRefs);
    }
    return [...new Set(refs)];
  }

  /* diagnostics */

  fileErrors = this.globalQuery(fileErrors);
  fileWarnings = this.globalQuery(fileWarnings);
  projectErrors = this.globalQuery(projectErrors);
  projectWarnings = this.globalQuery(projectWarnings);

  readonly token = {
    flatStream: this.localQuery(flatStream),
    invalidStream: this.localQuery(invalidStream),
  };

  readonly symbol = {
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
    ast: () => this.parseFile(DEFAULT_ENTRY).getValue().ast,
    /** @deprecated Use `compiler.fileErrors(filepath)` */
    errors: () => this.fileErrors(DEFAULT_ENTRY),
    /** @deprecated Use `compiler.fileWarnings(filepath)` */
    warnings: () => this.fileWarnings(DEFAULT_ENTRY),
    /** @deprecated Use `compiler.parseFile(filepath).tokens` */
    tokens: () => this.parseFile(DEFAULT_ENTRY).getValue().tokens,
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
