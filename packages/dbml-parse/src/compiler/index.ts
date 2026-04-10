import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { invalidStream, flatStream } from './queries/legacy/token';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
import { renameTable } from './queries/transform';
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput } from './queries/transform';
import {
  nodeSymbol,
  symbolMembers,
  nodeReferee,
  bindNode,
  interpretNode,
} from '@/core/global_modules';
import { symbolReferences } from './queries/symbolReferences';
import { intern, type Internable, type Primitive } from '@/core/types/internable';
import { DEFAULT_ENTRY } from '@/constants';
import { nodeAlias, nodeFullname as fullname, nodeSettings, validateNode } from '@/core/local_modules';
import { NodeSymbolIdGenerator } from '@/core/types/symbols';
import SymbolFactory from '@/core/types/symbolFactory';
import { lookupMembers } from './queries/lookupMembers';
import { symbolName } from './queries/symbolName';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import { type DbmlProjectLayout, MemoryProjectLayout } from './projectLayout';
import { fileDependencies } from './queries/fileDependencies';
import { Filepath } from '@/core/types/filepath';
import { usableMembers } from './queries/usableMembers';
import { topLevelSchemaMembers } from './queries/topLevelSchemaMembers';
import { reachableFiles } from './queries/reachableFiles';
import { parseFile, parseProject } from './queries/pipeline/parse';
import { ast, errors, publicSymbolTable, rawDb, tokens, warnings } from './queries/legacy/parse';
import { interpretFile, interpretProject, exportSchemaJson } from './queries/pipeline/interpret';
import { bindFile, bindProject } from './queries/pipeline/bind';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

// To detect cyclic queries
// Indicating that a query is being computed, but we're trying to compute it again
const COMPUTING = Symbol('COMPUTING');

export default class Compiler {
  private cache = new Map<symbol, any>();

  layout: DbmlProjectLayout = new MemoryProjectLayout();

  nodeIdGenerator = new SyntaxNodeIdGenerator();

  symbolIdGenerator = new NodeSymbolIdGenerator();

  symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  setSource (filepath: Filepath, source: string) {
    this.layout.setSource(filepath, source);
    this.cache.clear();
  }

  clearSource () {
    this.layout = new MemoryProjectLayout();
    this.cache.clear();
  }

  deleteSource (filepath: Filepath) {
    this.layout.deleteSource(filepath);
    this.cache.clear();
  }

  private query<Args extends (Primitive | Primitive[] | Internable<Primitive>)[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
  ): (...args: Args) => Return {
    const queryKey = Symbol();
    return ((...args: Args): Return => {
      const argKey = args.map((a) => intern(a)).join('\0');
      let subCache = this.cache.get(queryKey);
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
        this.cache.set(queryKey, subCache);
      }
      subCache.set(argKey, COMPUTING);

      const result = fn.apply(this, args);
      subCache.set(argKey, result);
      return result;
    }) as (...args: Args) => Return;
  }

  // global queries
  parseProject = this.query(parseProject);

  bindNode = this.query(bindNode);
  bindProject = this.query(bindProject);
  bindFile = this.query(bindFile);

  nodeSymbol = this.query(nodeSymbol);
  symbolMembers = this.query(symbolMembers);
  lookupMembers = this.query(lookupMembers);

  symbolReferences = this.query(symbolReferences);
  nodeReferee = this.query(nodeReferee);

  interpretNode = this.query(interpretNode);
  interpretFile = this.query(interpretFile);
  interpretProject = this.query(interpretProject);
  exportSchemaJson = this.query(exportSchemaJson);

  // local queries
  parseFile = this.query(parseFile);

  topLevelSchemaMembers = this.query(topLevelSchemaMembers);
  reachableFiles = this.query(reachableFiles);
  fileUsableMembers = this.query(usableMembers);
  fileDependencies = this.query(fileDependencies);
  validateNode = this.query(validateNode);
  nodeFullname = this.query(fullname);
  symbolName = this.query(symbolName);
  nodeAlias = this.query(nodeAlias);
  nodeSettings = this.query(nodeSettings);

  // transform queries
  renameTable = renameTable.bind(this);

  // @deprecated - legacy APIs for services compatibility
  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: () => this.layout.getSource(DEFAULT_ENTRY) as Readonly<string>,
    _: this.query(exportSchemaJson),
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
