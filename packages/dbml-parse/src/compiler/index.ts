import {
  bindNode,
  interpretMetadata,
  interpretSymbol,
  nodeReferee,
  nodeSymbol,
  symbolMembers,
} from '@/core/global_modules';
import {
  nodeFullname as fullname, nodeAlias, nodeSettings, validateNode,
} from '@/core/local_modules';
import {
  Filepath,
  FilepathId,
} from '@/core/types/filepath';
import {
  type Internable, type Primitive, intern,
} from '@/core/types/internable';
import {
  SyntaxNode, SyntaxNodeIdGenerator,
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
  canonicalName,
} from './queries/canonicalName';
import {
  fileDependencies,
} from './queries/files/fileDependencies';
import {
  reachableFiles,
} from './queries/files/reachableFiles';
import {
  usableMembers,
} from './queries/files/usableMembers';
import {
  ast, errors, publicSymbolTable, rawDb, tokens, warnings,
} from './queries/legacy/parse';
import {
  flatStream, invalidStream,
} from './queries/legacy/token';
import {
  nodeAtPosition,
} from './queries/nodeAtPosition';
import {
  bindFile, bindProject,
} from './queries/pipeline/bind';
import {
  interpretFile, interpretProject,
} from './queries/pipeline/interpret';
import {
  exportSchemaJson,
} from './queries/pipeline/export';
import {
  parseFile, parseProject,
} from './queries/pipeline/parse';
import {
  lookupMembers,
} from './queries/symbol/lookupMembers';
import {
  symbolAliases,
} from './queries/symbol/symbolAliases';
import {
  resolutionIndex, symbolMetadata, symbolReferences,
} from './queries/resolutionIndex';
import {
  symbolUses,
} from './queries/symbol/symbolUses';
import {
  renameTable, syncDiagramView,
} from './queries/transform';
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
// If a the compiler reads `COMPUTING` from the cache
// it means we have a cycle.
const COMPUTING = Symbol('COMPUTING');

// The unique identifier for a query
type QuerySymbol = symbol;

export default class Compiler {
  // Interners
  nodeIdGenerator = new SyntaxNodeIdGenerator();

  private symbolIdGenerator = new NodeSymbolIdGenerator();
  symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  // The structure of the DbmlProject
  layout: DbmlProjectLayout = new MemoryProjectLayout();

  setSource (filepath: Filepath, source: string) {
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

  deleteSource (filepath: Filepath) {
    this.layout.deleteSource(filepath);
    // Same invalidation logic as setSource: local per-file, global always full clear.
    this.localCache.delete(filepath.intern());
    this.globalCache.clear();
  }

  // A global cache mapping from:
  // (QuerySymbol, interned argument string) -> Result
  private globalCache = new Map<QuerySymbol, Map<string, any>>();

  // Turn a normal function into a Compiler's global query
  // Input: A function that only accepts internable types | primitive types
  // Output: A global query wrapping the function
  private globalQuery<Args extends (Primitive | Primitive[] | Internable<Primitive>)[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const queryKey = Symbol();

    return ((...args: Args): Return => {
      if (!this.globalCache.has(queryKey)) {
        this.globalCache.set(queryKey, new Map());
      }

      const argKey = args.map((a) => intern(a)).join('\0');
      const subCache = this.globalCache.get(queryKey)!;

      if (subCache.has(argKey)) {
        const cached = subCache.get(argKey);
        if (cached === COMPUTING) {
          throw new Error(`Cycle detected in query: ${fn.name}(${argKey})`);
        }
        return cached;
      }

      // Sentinel detects cycles when a query re-enters itself
      subCache.set(argKey, COMPUTING);
      try {
        const result = fn.apply(this, args);
        subCache.set(argKey, result);
        return result;
      } catch (e) {
        subCache.delete(argKey);
        throw e;
      }
    }) as (...args: Args) => Return;
  }

  // A local cache mapping from:
  // (Filepath, QuerySymbol, interned argument string) -> Result
  private localCache = new Map<FilepathId, Map<QuerySymbol, Map<string, any>>>();

  // Turn a normal function into a Compiler's local query
  // Input: A function whose first arg is a Filepath or SyntaxNode (from which we extract .filepath)
  //        & accepts internable types | primitive types for the rest
  // Output: A local query wrapping the function, cached per-file
  private localQuery<Args extends [
    Filepath | SyntaxNode, // filepath or node as first arg
    ...(Primitive | Primitive[] | Internable<Primitive>)[],
  ], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    // 1. Generates a unique query symbol for the query
    const queryKey = Symbol();

    return ((...args: Args): Return => {
      const [
        firstArg,
      ] = args;
      const filepath = firstArg instanceof SyntaxNode ? firstArg.filepath : firstArg;
      const filepathId = filepath.intern();
      const argKey = args.map((a) => intern(a)).join('\0');

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

      // Sentinel detects cycles when a query re-enters itself
      subCache.set(argKey, COMPUTING);
      try {
        const result = fn.apply(this, args);
        subCache.set(argKey, result);
        return result;
      } catch (e) {
        subCache.delete(argKey);
        throw e;
      }
    }) as (...args: Args) => Return;
  }

  // A local query
  // Lex + parse a single file into an AST
  // Signature: (filepath: Filepath) => Report<FileParseIndex>
  parseFile = this.localQuery(parseFile);
  // A global query
  // Lex + parse all entry-point files
  // Returns a map from the file's absolute path to FileParseIndex
  // Signature: () => Map<string, Report<FileParseIndex>>
  parseProject = this.globalQuery(parseProject);

  // A local query
  // Validate an AST node and return any compile errors
  // Signature: (node: SyntaxNode) => Report<void> | Report<Unhandled>
  validateNode = this.localQuery(validateNode);
  // A local query
  // Return the fully-qualified name segments of an AST node (e.g. ['public', 'users'])
  // Signature: (node: SyntaxNode) => Report<string[] | undefined> | Report<Unhandled>
  nodeFullname = this.localQuery(fullname);
  // A local query
  // Return the alias string of an AST node if one is declared
  // Signature: (node: SyntaxNode) => Report<string | undefined> | Report<Unhandled>
  nodeAlias = this.localQuery(nodeAlias);
  // A local query
  // Return the settings/options map of an AST node
  // Signature: (node: SyntaxNode) => Report<Settings> | Report<Unhandled>
  nodeSettings = this.localQuery(nodeSettings);
  // A global query
  // Canonical name of a symbol as seen from a file (real name > use alias > alias > original)
  // Signature: (filepath: Filepath, symbol: NodeSymbol) => Report<{ schema: string; name: string } | undefined>
  canonicalName = this.globalQuery(canonicalName);

  // A global query
  // Run the binder on a single AST node
  // Signature: (node: SyntaxNode) => Report<void> | Report<Unhandled>
  bindNode = this.globalQuery(bindNode);
  // A global query
  // Bind a single file's AST (calls bindNode on the root)
  // Signature: (filepath: Filepath) => Report<void>
  bindFile = this.globalQuery(bindFile);
  // A global query
  // Bind all entry-point files in dependency order
  // Returns a map from the file's absolute path to bind errors
  // Signature: () => Map<string, Report<void>>
  bindProject = this.globalQuery(bindProject);

  // A global query
  // Interpret a symbol into a SchemaElement using enriched symbol API
  // Signature: (symbol: NodeSymbol, filepath?: Filepath) => Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled>
  interpretSymbol = this.globalQuery(interpretSymbol);
  // A global query
  // Interpret metadata (ref, check, index, record) into a SchemaElement
  // Signature: (metadata: SymbolMetadata) => Report<SchemaElement | SchemaElement[] | undefined> | Report<Unhandled>
  interpretMetadata = interpretMetadata.bind(this);
  // A global query
  // Interpret a single file's AST into a raw Database
  // Signature: (filepath: Filepath) => Report<Readonly<Database> | undefined>
  interpretFile = this.globalQuery(interpretFile);

  // A global query
  // Interpret all reachable files and merge into a MasterDatabase (A database but for multifile)
  // Signature: () => Report<MasterDatabase>
  interpretProject = this.globalQuery(interpretProject);
  // A global query
  // Start from an entrypoint file, collects all imports and merges into the entrypoint
  // Export a Database representing this merged view of the MasterDatabase
  // Signature: (filepath: Filepath) => Report<Readonly<Database> | undefined>
  exportSchemaJson = this.globalQuery(exportSchemaJson);

  // A global query
  // Return the NodeSymbol for a single SyntaxNode
  // Signature: (node: SyntaxNode) => Report<NodeSymbol> | Report<Unhandled>
  nodeSymbol = this.globalQuery(nodeSymbol);
  // A global query
  // Return all direct child symbols of a symbol
  // Signature: (symbol: NodeSymbol) => Report<NodeSymbol[]> | Report<Unhandled>
  symbolMembers = this.globalQuery(symbolMembers);
  // A global query
  // Look up a member by kind and name inside a symbol or node scope
  // Signature: (symbolOrNode: NodeSymbol | SyntaxNode, targetKind: SymbolKind, targetName: string) => Report<NodeSymbol | undefined>
  lookupMembers = this.globalQuery(lookupMembers);
  // A global query
  // Resolve what symbol a reference node points to. Related: nodeSymbol, symbolReferences.
  // Signature: (node: SyntaxNode) => Report<NodeSymbol | undefined> | Report<Unhandled>
  nodeReferee = this.globalQuery(nodeReferee);
  resolutionIndex = this.globalQuery(resolutionIndex);
  symbolReferences = this.globalQuery(symbolReferences);
  symbolMetadata = this.globalQuery(symbolMetadata);
  // A global query
  // Return all AliasSymbols across the project whose originalSymbol is the given symbol (transitive).
  // Signature: (symbol: NodeSymbol) => Report<AliasSymbol[]>
  symbolAliases = this.globalQuery(symbolAliases);
  // A global query
  // Return all UseSymbols across the project whose originalSymbol is the given symbol (transitive).
  // Signature: (symbol: NodeSymbol) => Report<UseSymbol[]>
  symbolUses = this.globalQuery(symbolUses);

  // A local query
  // Return the direct import filepath IDs declared by use statements in a file. Related: reachableFiles.
  // Signature: (filepath: Filepath) => Filepath[]
  fileDependencies = this.localQuery(fileDependencies);
  // A local query
  // BFS-traverse imports from an entry filepath and return all reachable files. Related: fileDependencies.
  // Signature: (entry: Filepath) => Filepath[]
  reachableFiles = this.localQuery(reachableFiles);
  // A global query
  // Return the importable members (non-schema, schema, reuses, uses) of a schema symbol or file. Related: topLevelSchemaMembers.
  // Signature: (symbolOrFilepath: SchemaSymbol | Filepath) => Report<{ nonSchemaMembers, schemaMembers, reuses, uses }>
  usableMembers = this.globalQuery(usableMembers);

  // A local query
  // Given a file and an offset, return the deepest AST node or token containing that position.
  // Signature: (filepath: Filepath, offset: number) => SyntaxNode | SyntaxToken | undefined
  nodeAtPosition = this.localQuery(nodeAtPosition);

  // transform queries
  renameTable = renameTable.bind(this);
  syncDiagramView = syncDiagramView.bind(this);

  // @deprecated - legacy APIs for services compatibility
  readonly token = {
    invalidStream: this.localQuery(invalidStream),
    flatStream: this.localQuery(flatStream),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: (filepath: Filepath) => this.layout.getSource(filepath) || '',
    ast: this.localQuery(ast),
    errors: this.globalQuery(errors),
    warnings: this.globalQuery(warnings),
    tokens: this.localQuery(tokens),
    rawDb: this.globalQuery(rawDb),
    publicSymbolTable: this.globalQuery(publicSymbolTable),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly container = {
    stack: this.localQuery(containerStack),
    token: this.localQuery(containerToken),
    element: this.localQuery(containerElement),
    scope: this.localQuery(containerScope),
    scopeKind: this.localQuery(containerScopeKind),
  };

  async initMonacoServices (options?: {
    autocompletion?: {
      triggerCharacters?: string[];
    };
  }) {
    const triggerCharacters = options?.autocompletion?.triggerCharacters ?? [
      '.',
      ',',
      '[',
      '(',
      ':',
      '>',
      '<',
      '-',
      '~',
      '\'',
      '"',
      '/',
      ' ',
    ];

    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this, {
        triggerCharacters,
      }),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
    };
  }
}
