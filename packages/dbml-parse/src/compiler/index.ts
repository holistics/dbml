import {
  DEFAULT_ENTRY,
} from '@/constants';
import {
  bindNode,
  interpretNode,
  nodeReferee,
  nodeSymbol,
  symbolMembers,
} from '@/core/global_modules';
import {
  nodeFullname as fullname, nodeAlias, nodeSettings, validateNode,
} from '@/core/local_modules';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  type Internable, type Primitive, intern,
} from '@/core/types/internable';
import {
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import {
  NodeSymbolIdGenerator, SymbolFactory,
} from '@/core/types/symbol';
import {
  DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLDiagnosticsProvider, DBMLReferencesProvider,
} from '@/services/index';
import {
  type DbmlProjectLayout, MemoryProjectLayout,
} from './projectLayout';
import {
  containerElement, containerScope, containerScopeKind, containerStack, containerToken,
} from './queries/container';
import {
  fileDependencies,
} from './queries/fileDependencies';
import {
  ast, errors, publicSymbolTable, rawDb, tokens, warnings,
} from './queries/legacy/parse';
import {
  flatStream, invalidStream,
} from './queries/legacy/token';
import {
  lookupMembers,
} from './queries/lookupMembers';
import {
  bindFile, bindProject,
} from './queries/pipeline/bind';
import {
  exportSchemaJson, interpretFile, interpretProject,
} from './queries/pipeline/interpret';
import {
  parseFile, parseProject,
} from './queries/pipeline/parse';
import {
  reachableFiles,
} from './queries/reachableFiles';
import {
  symbolName,
} from './queries/symbolName';
import {
  symbolReferences,
} from './queries/symbolReferences';
import {
  topLevelSchemaMembers,
} from './queries/topLevelSchemaMembers';
import {
  renameTable, syncDiagramView,
} from './queries/transform';
import {
  usableMembers,
} from './queries/usableMembers';
import {
  addDoubleQuoteIfNeeded, escapeString, formatRecordValue, isValidIdentifier, splitQualifiedIdentifier, unescapeString,
} from './queries/utils';

// Re-export types
export {
  ScopeKind,
} from './types';
export type {
  TableNameInput, TextEdit,
} from './queries/transform';
// Re-export utilities
export {
  addDoubleQuoteIfNeeded, escapeString, formatRecordValue, isValidIdentifier, splitQualifiedIdentifier, unescapeString,
};

// Sentinel placed in the cache while a query is being computed.
// If a re-entrant call hits the same cache slot it means we have a cycle.
const COMPUTING = Symbol('COMPUTING');

type QuerySubCache = Map<string, any>;

/**
 * ## Query system invariants
 *
 * Every public method on Compiler that begins with a lowercase noun (e.g.
 * `parseFile`, `bindNode`, `symbolName`) is a **query**: a memoised,
 * lazily-evaluated function with the following invariants:
 *
 * 1. **Purity** — queries must not mutate any shared state. They read from
 *    `this.layout` and from other cached queries, and return a value.
 *    Side-effecting logic belongs in `setSource` / `deleteSource`.
 *
 * 2. **Cache scope** — each query is registered with `this.query()` (global)
 *    or `this.localQuery()` (per-file):
 *    - `query()`: cached across all files. Invalidated entirely on any
 *      `setSource` / `deleteSource` / `clearSource` call.
 *    - `localQuery()`: cached per `Filepath.intern()` key. Only the changed
 *      file's cache entry is deleted on `setSource(filepath, ...)`.
 *    Use `localQuery` only when the function's output depends solely on the
 *    content of a single file (e.g. `parseFile`, `topLevelSchemaMembers`).
 *
 * 3. **Single wrapping** — each query function must be passed to `query()` or
 *    `localQuery()` exactly once. Each call allocates a unique `Symbol()` as
 *    the cache key; double-wrapping creates a second key and defeats caching.
 *
 * 4. **Cycle detection** — if a query calls itself (directly or transitively)
 *    before its result is stored, the COMPUTING sentinel is found in the cache
 *    and an error is thrown. This surfaces infinite loops at development time.
 *
 * 5. **Error propagation** — query functions return `Report<T>` objects that
 *    carry errors alongside values. A thrown exception is NOT caught by the
 *    cache layer; it propagates to the caller and the cache slot is left as
 *    COMPUTING (i.e., the entry is poisoned). Do not throw from queries.
 */
export default class Compiler {
  private globalCache = new Map<symbol, QuerySubCache>();

  // Outer key: Filepath.intern() string; inner key: queryKey symbol; innermost key: serialized remaining args.
  // Invariant: Filepath.intern() must return a stable, unique string per logical filepath across the
  // lifetime of this Compiler instance. If interning semantics change, per-file cache invalidation breaks.
  private localCache = new Map<string, Map<symbol, QuerySubCache>>();

  layout: DbmlProjectLayout = new MemoryProjectLayout();

  nodeIdGenerator = new SyntaxNodeIdGenerator();

  private symbolIdGenerator = new NodeSymbolIdGenerator();

  symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  setSource (source: string): void;
  setSource (filepath: Filepath, source: string): void;
  setSource (filepathOrSource: Filepath | string, _source?: string) {
    const filepath = filepathOrSource instanceof Filepath ? filepathOrSource : DEFAULT_ENTRY;
    const source = filepathOrSource instanceof Filepath ? _source! : filepathOrSource;
    this.layout.setSource(filepath, source);
    // Local queries are keyed per-file: only the changed file's cache is stale.
    // Global queries depend on all files: always invalidate the entire global cache.
    this.localCache.delete(filepath.intern());
    this.globalCache.clear();
  }

  clearSource () {
    this.layout = new MemoryProjectLayout();
    this.localCache.clear();
    this.globalCache.clear();
  }

  deleteSource (filepath: Filepath = DEFAULT_ENTRY) {
    this.layout.deleteSource(filepath);
    // Same invalidation logic as setSource: local per-file, global always full clear.
    this.localCache.delete(filepath.intern());
    this.globalCache.clear();
  }

  private query<Args extends (Primitive | Primitive[] | Internable<Primitive>)[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const queryKey = Symbol();
    return ((...args: Args): Return => {
      const argKey = args.map((a) => intern(a)).join('\0');
      let subCache = this.globalCache.get(queryKey);
      if (subCache instanceof Map) {
        if (subCache.has(argKey)) {
          const cached = subCache.get(argKey);
          if (cached === COMPUTING) {
            throw new Error(`Cycle detected in query: ${fn.name}(${argKey})`);
          }
          return cached;
        }
      }

      if (!(subCache instanceof Map)) {
        subCache = new Map();
        this.globalCache.set(queryKey, subCache);
      }
      subCache.set(argKey, COMPUTING);

      const result = fn.apply(this, args);
      subCache.set(argKey, result);
      return result;
    }) as (...args: Args) => Return;
  }

  private localQuery<Args extends [Filepath, ...(Primitive | Primitive[] | Internable<Primitive>)[]], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const queryKey = Symbol();
    return ((...args: Args): Return => {
      const [filepath, ...rest] = args;
      const filepathId = filepath.intern();
      const argKey = rest.map((a) => intern(a)).join('\0');

      let filepathCache = this.localCache.get(filepathId);
      if (!filepathCache) {
        filepathCache = new Map();
        this.localCache.set(filepathId, filepathCache);
      }

      let subCache = filepathCache.get(queryKey);
      if (!subCache) {
        subCache = new Map();
        filepathCache.set(queryKey, subCache);
      }

      if (subCache.has(argKey)) {
        const cached = subCache.get(argKey);
        if (cached === COMPUTING) {
          throw new Error(`Cycle detected in query: ${fn.name}(${filepathId}, ${argKey})`);
        }
        return cached;
      }

      subCache.set(argKey, COMPUTING);
      const result = fn.apply(this, args);
      subCache.set(argKey, result);
      return result;
    }) as (...args: Args) => Return;
  }

  // A local query.
  // Lex + parse a single file into an AST. Related: parseProject.
  // (filepath: Filepath) => Report<FileParseIndex>
  parseFile = this.localQuery(parseFile);
  // A global query.
  // Lex + parse all entry-point files. Related: parseFile.
  // () => Map<string, Report<FileParseIndex>>
  parseProject = this.query(parseProject);

  // A global query.
  // Run the binder on a single AST node (dispatches to global modules). Related: bindFile, bindProject.
  // (node: SyntaxNode) => Report<void> | Report<Unhandled>
  bindNode = this.query(bindNode);
  // A global query.
  // Bind a single file's AST (calls bindNode on the root). Related: bindNode, bindProject.
  // (filepath: Filepath) => Report<void>
  bindFile = this.query(bindFile);
  // A global query.
  // Bind all entry-point files in dependency order. Related: bindFile.
  // () => Map<string, Report<void>>
  bindProject = this.query(bindProject);

  // A global query.
  // Interpret a single AST node into a SchemaElement (dispatches to global modules). Related: interpretFile, interpretProject.
  // (node: SyntaxNode) => Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled>
  interpretNode = this.query(interpretNode);
  // A global query.
  // Interpret a single file's AST into a raw Database. Related: interpretNode, interpretProject.
  // (filepath: Filepath) => Report<Readonly<Database> | undefined>
  interpretFile = this.query(interpretFile);
  // A global query.
  // Interpret all reachable files and merge into a MasterDatabase. Related: interpretFile.
  // () => Report<MasterDatabase>
  interpretProject = this.query(interpretProject);
  // A global query.
  // Export a reconciled, alias-resolved Database for a single file (calls interpretProject internally). Related: interpretProject.
  // (filepath: Filepath) => Report<Readonly<Database> | undefined>
  exportSchemaJson = this.query(exportSchemaJson);

  // A global query.
  // Resolve the NodeSymbol declared by a given AST node. Related: symbolMembers, nodeReferee.
  // (node: SyntaxNode) => Report<NodeSymbol> | Report<Unhandled>
  nodeSymbol = this.query(nodeSymbol);
  // A global query.
  // Return all direct child symbols of a symbol. Related: nodeSymbol, lookupMembers.
  // (symbol: NodeSymbol) => Report<NodeSymbol[]> | Report<Unhandled>
  symbolMembers = this.query(symbolMembers);
  // A global query.
  // Look up a member by kind and name inside a symbol or node scope. Related: symbolMembers.
  // (symbolOrNode: NodeSymbol | SyntaxNode, targetKind: SymbolKind, targetName: string) => Report<NodeSymbol | undefined>
  lookupMembers = this.query(lookupMembers);
  // A global query.
  // Resolve what symbol a reference node points to. Related: nodeSymbol, symbolReferences.
  // (node: SyntaxNode) => Report<NodeSymbol | undefined> | Report<Unhandled>
  nodeReferee = this.query(nodeReferee);
  // A global query.
  // Find all reference nodes that point to a given symbol. Related: nodeReferee.
  // (symbol: NodeSymbol) => Report<SyntaxNode[]>
  symbolReferences = this.query(symbolReferences);

  // A global query.
  // Validate an AST node and return any compile errors.
  // (node: SyntaxNode) => Report<void> | Report<Unhandled>
  validateNode = this.query(validateNode);
  // A global query.
  // Return the fully-qualified name segments of an AST node (e.g. ['public', 'users']).
  // (node: SyntaxNode) => Report<string[] | undefined> | Report<Unhandled>
  nodeFullname = this.query(fullname);
  // A global query.
  // Return the display name string of a symbol (last segment of its fullname, or alias). Related: nodeFullname.
  // (symbol: NodeSymbol) => string | undefined
  symbolName = this.query(symbolName);
  // A global query.
  // Return the alias string of an AST node if one is declared. Related: nodeFullname.
  // (node: SyntaxNode) => Report<string | undefined> | Report<Unhandled>
  nodeAlias = this.query(nodeAlias);
  // A global query.
  // Return the settings/options map of an AST node.
  // (node: SyntaxNode) => Report<Settings> | Report<Unhandled>
  nodeSettings = this.query(nodeSettings);

  // A local query.
  // Return the direct import filepath IDs declared by use statements in a file. Related: reachableFiles.
  // (filepath: Filepath) => Set<string>
  fileDependencies = this.localQuery(fileDependencies);
  // A local query.
  // BFS-traverse imports from an entry filepath and return all reachable files. Related: fileDependencies.
  // (entry: Filepath) => Set<Filepath>
  reachableFiles = this.localQuery(reachableFiles);
  // A local query.
  // Return the top-level SchemaSymbols declared directly in a file. Related: fileUsableMembers.
  // (filepath: Filepath) => SchemaSymbol[]
  topLevelSchemaMembers = this.localQuery(topLevelSchemaMembers);
  // A global query.
  // Return the importable members (non-schema, schema, reuses, uses) of a schema symbol or file. Related: topLevelSchemaMembers.
  // (symbolOrFilepath: SchemaSymbol | Filepath) => Report<{ nonSchemaMembers, schemaMembers, reuses, uses }>
  fileUsableMembers = this.query(usableMembers);

  // transform queries
  renameTable = renameTable.bind(this);
  syncDiagramView = syncDiagramView.bind(this);

  // @deprecated - legacy APIs for services compatibility
  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: () => this.layout.getSource(DEFAULT_ENTRY) as Readonly<string>,
    _: () => this.exportSchemaJson(DEFAULT_ENTRY),
    ast: this.query(ast),
    errors: this.query(errors),
    warnings: this.query(warnings),
    tokens: this.query(tokens),
    rawDb: this.query(rawDb),
    publicSymbolTable: this.query(publicSymbolTable),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly container = {
    stack: this.query(containerStack),
    token: this.query(containerToken),
    element: this.query(containerElement),
    scope: this.query(containerScope),
    scopeKind: this.query(containerScopeKind),
  };

  async initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
    };
  }
}
