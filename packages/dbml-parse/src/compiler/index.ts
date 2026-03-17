import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { type FilepathKey } from './projectLayout';
import { type FileIndex } from './types';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { parseFile, parseProject, analyzeProject, interpretProject } from './queries/pipeline';
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

  /* token */

  // A global query
  // Ordered flat stream of every token across all files,
  // with leading/trailing invalid tokens interleaved in source order
  // Signature: () => readonly SyntaxToken[]
  flatTokenStream = this.globalQuery(flatTokenStream);

  // A global query
  // All tokens that failed to lex
  // Signature: () => readonly SyntaxToken[]
  invalidTokens = this.globalQuery(invalidTokens);

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
