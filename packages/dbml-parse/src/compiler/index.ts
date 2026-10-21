import {
  bindNode,
  interpretMetadata,
  interpretSymbol,
  nodeMetadata,
  nodeReferee,
  nodeSymbol,
  symbolMembers,
} from '@/core/global_modules';
import {
  nodeFullname, nodeAlias, nodeSettings, validateNode,
} from '@/core/local_modules';
import {
  Filepath,
  FilepathId,
} from '@/core/types/filepath';
import { type Internable, type Primitive, intern } from '@/core/types/internable';
import { SyntaxNode, SyntaxNodeIdGenerator } from '@/core/types/nodes';
import { NodeSymbolIdGenerator, SymbolFactory } from '@/core/types/symbol';
import {
  DBMLCodeActionProvider, DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLDiagnosticsProvider, DBMLReferencesProvider,
} from '@/services/index';
import { type DbmlProjectLayout } from './projectLayout';
import {
  containerElement, containerScope, containerScopeKind, containerStack, containerToken,
} from './queries/container';
import { canonicalName } from './queries/canonicalName';
import { fileDependencies } from './queries/files/fileDependencies';
import { reachableFiles, walkDependencies } from './queries/files/reachableFiles';
import { usableMembers } from './queries/files/usableMembers';
import {
  ast, errors, publicSymbolTable, rawDb, tokens, warnings,
} from './queries/legacy/parse';
import { flatStream, invalidStream } from './queries/legacy/token';
import { nodeAtPosition } from './queries/nodeAtPosition';
import { bindFile, bindProject } from './queries/pipeline/bind';
import { interpretFile, interpretProject } from './queries/pipeline/interpret';
import { validateFile } from './queries/pipeline/validate';
import { parseFile, parseProject } from './queries/pipeline/parse';
import { lookupMembers, symbolMembersLookupMap } from './queries/symbol/lookupMembers';
import { symbolAliases } from './queries/symbol/symbolAliases';
import {
  resolutionIndex, symbolMetadata, symbolParent, symbolReferences,
} from './queries/resolutionIndex';
import { symbolUses } from './queries/symbol/symbolUses';
import {
  renameTable, syncDiagramView, syncDep, updateElementSetting, updateElementSettingEdit,
  findMetadataBlock, updateElementMetadata, updateElementMetadataEdit,
} from './queries/transform';
import {
  addDoubleQuoteIfNeeded, escapeString, formatTypedValue, isValidIdentifier, normalizeQualifiedName, splitQualifiedIdentifier, unescapeString, type TypedValue,
} from './queries/utils';
import { DEFAULT_ENTRY } from '@/constants';

// Re-export types
export { ScopeKind } from './types';
export type { TextEdit } from './queries/transform';
// Re-export utilities
export {
  addDoubleQuoteIfNeeded, escapeString, formatTypedValue, isValidIdentifier, normalizeQualifiedName, splitQualifiedIdentifier, unescapeString,
};
export type { TypedValue };

// Sentinel placed in the cache while a query is being computed, indicating a cycle
const COMPUTING = Symbol('COMPUTING');

// The unique identifier for a query
type QuerySymbol = symbol;

export default class Compiler {
  readonly nodeIdGenerator = new SyntaxNodeIdGenerator();
  readonly symbolIdGenerator = new NodeSymbolIdGenerator();
  readonly symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  // The structure of the DbmlProject
  constructor (public layout: DbmlProjectLayout) {}

  getSource (filepath: Filepath): string | undefined {
    return this.layout.getSource(filepath);
  }

  private sourceSnapshot = new Map<string, string | undefined>();
  // Purge local + global caches if `filepath`'s content changed since last seen
  private cleanStaleLocalCache (filepath: Filepath): void {
    const content = this.layout.getSource(filepath);
    const key = filepath.absolute;

    const snapshot = this.sourceSnapshot.get(key);
    if (snapshot !== undefined) {
      if (snapshot !== content) {
        this.localCache.delete(filepath.intern());
        this.globalCache.clear();

        this.sourceSnapshot.set(key, content); // reset snapshot on change
      }
    } else {
      this.sourceSnapshot.set(key, content); // reset snapshot if not set yet
    }
  }

  private entrypointsSnapshot: Filepath[] | undefined;
  // Purge global cache if entrypoints or any reachable file's content changed
  private cleanStaleGlobalCache (): void {
    const entrypoints = this.layout.getEntrypoints();

    // Check if entrypoints changed
    let dirty = false;
    if (this.entrypointsSnapshot !== undefined) {
      if (this.entrypointsSnapshot.length !== entrypoints.length
        || this.entrypointsSnapshot.some((fp, i) => fp.absolute !== entrypoints[i].absolute)) {
        dirty = true;
      }
    }
    this.entrypointsSnapshot = entrypoints;

    // Ensure local caches are fresh for all reachable files
    for (const fp of walkDependencies(this, entrypoints)) {
      this.cleanStaleLocalCache(fp);
    }

    if (dirty) {
      this.globalCache.clear();
    }
  }

  // A global cache mapping from:
  // (QuerySymbol, interned argument string) -> Result
  private globalCache = new Map<QuerySymbol, Map<string, any>>();

  private globallyQuerying = false; // Check if we're already inside a query, we only need to check global cache staleness once when enter the first query: queries calling each other would not have stale global cache

  // Turn a normal function into a Compiler's global query
  // Input: A function that only accepts internable types | primitive types
  // Output: A global query wrapping the function
  private globalQuery<Args extends (Primitive | Primitive[] | Internable<Primitive>)[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const queryKey = Symbol();

    return ((...args: Args): Return => {
      const isTopLevel = !this.globallyQuerying;
      if (isTopLevel) {
        this.globallyQuerying = true;
        this.cleanStaleGlobalCache();
      }

      try {
        let subCache = this.globalCache.get(queryKey);
        if (!subCache) {
          subCache = new Map();
          this.globalCache.set(queryKey, subCache);
        }

        const argKey = args.length === 0
          ? ''
          : args.length === 1
            ? intern(args[0]) as string
            : args.map((a) => intern(a)).join('\0');

        const cached = subCache.get(argKey);
        if (cached) {
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
      } finally {
        if (isTopLevel) this.globallyQuerying = false;
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

      // Detect source changes before cache lookup
      this.cleanStaleLocalCache(filepath);

      const filepathId = filepath.intern();
      const argKey = args.length === 0
        ? ''
        : args.length === 1
          ? intern(args[0]) as string
          : args.map((a) => intern(a)).join('\0');

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

  parseFile = this.localQuery(parseFile);
  parseProject = this.globalQuery(parseProject);

  validateNode = this.localQuery(validateNode);
  validateFile = this.localQuery(validateFile);
  nodeFullname = this.localQuery(nodeFullname);
  nodeAlias = this.localQuery(nodeAlias);
  nodeSettings = this.localQuery(nodeSettings);
  canonicalName = this.globalQuery(canonicalName);

  bindNode = this.globalQuery(bindNode);
  bindFile = this.globalQuery(bindFile);
  bindProject = this.globalQuery(bindProject);

  interpretSymbol = this.globalQuery(interpretSymbol);
  interpretMetadata = this.globalQuery(interpretMetadata);
  interpretFile = this.globalQuery(interpretFile);

  interpretProject = this.globalQuery(interpretProject);
  nodeSymbol = this.globalQuery(nodeSymbol);
  nodeMetadata = this.globalQuery(nodeMetadata);
  symbolMembers = this.globalQuery(symbolMembers);
  symbolMembersLookupMap = this.globalQuery(symbolMembersLookupMap);
  lookupMembers = this.globalQuery(lookupMembers);
  nodeReferee = this.globalQuery(nodeReferee);
  resolutionIndex = this.globalQuery(resolutionIndex);
  symbolReferences = this.globalQuery(symbolReferences);
  symbolParent = this.globalQuery(symbolParent);
  symbolMetadata = this.globalQuery(symbolMetadata);
  symbolAliases = this.globalQuery(symbolAliases);
  symbolUses = this.globalQuery(symbolUses);

  fileDependencies = this.localQuery(fileDependencies);
  reachableFiles = this.globalQuery(reachableFiles);
  usableMembers = this.globalQuery(usableMembers);

  nodeAtPosition = this.localQuery(nodeAtPosition);

  // transform queries
  renameTable = renameTable.bind(this);
  updateElementSetting = updateElementSetting.bind(this);
  updateElementSettingEdit = updateElementSettingEdit.bind(this);
  findMetadataBlock = findMetadataBlock.bind(this);
  updateElementMetadata = updateElementMetadata.bind(this);
  updateElementMetadataEdit = updateElementMetadataEdit.bind(this);
  syncDiagramView = syncDiagramView.bind(this);
  syncDep = syncDep.bind(this);

  // @deprecated - legacy APIs for services compatibility
  readonly token = {
    invalidStream: this.localQuery(invalidStream),
    flatStream: this.localQuery(flatStream),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: (filepath: Filepath) => this.getSource(filepath) || '',
    ast: (filepath = DEFAULT_ENTRY) => ast.call(this, filepath),
    errors: (filepath = DEFAULT_ENTRY) => errors.call(this, filepath),
    warnings: (filepath = DEFAULT_ENTRY) => warnings.call(this, filepath),
    tokens: (filepath = DEFAULT_ENTRY) => tokens.call(this, filepath),
    rawDb: (filepath = DEFAULT_ENTRY) => rawDb.call(this, filepath),
    publicSymbolTable: (filepath = DEFAULT_ENTRY) => publicSymbolTable.call(this, filepath),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly container = {
    stack: this.localQuery(containerStack),
    token: this.localQuery(containerToken),
    element: this.localQuery(containerElement),
    scope: this.localQuery(containerScope),
    scopeKind: this.localQuery(containerScopeKind),
  };

  initMonacoServices (options?: {
    autocompletion?: {
      triggerCharacters?: string[];
    };
  }) {
    const triggerCharacters = options?.autocompletion?.triggerCharacters ?? [];

    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this, {
        triggerCharacters,
      }),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
      codeActionProvider: new DBMLCodeActionProvider(this),
    };
  }
}
