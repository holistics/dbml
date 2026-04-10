import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { invalidStream, flatStream } from './queries/legacy/token';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
import { renameTable, type TableNameInput } from './queries/transform';
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput } from './queries/transform';
import {
  nodeSymbol,
  symbolMembers,
  nodeReferee,
  bind,
  interpret,
} from '@/core/global_modules';
import { symbolReferences } from './queries/symbolReferences';
import { intern, type Internable, type Primitive } from '@/core/types/internable';
import { alias, nodeFullname as fullname, settings, validate } from '@/core/local_modules';
import { NodeSymbolIdGenerator } from '@/core/types/symbols';
import { SymbolFactory } from '@/core/types/symbols';
import { lookupMembers } from './queries/lookupMembers';
import { symbolName } from './queries/symbolName';
import { SyntaxNodeIdGenerator } from '@/core/types/nodes';
import { parseFile } from './queries/pipeline/parse';
import { ast, errors, publicSymbolTable, rawDb, tokens, warnings } from './queries/legacy/parse';
import { interpretFile } from './queries/pipeline/interpret';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

// To detect cyclic queries
// Indicating that a query is being computed, but we're trying to compute it again
const COMPUTING = Symbol('COMPUTING');

export default class Compiler {
  private source = '';
  private cache = new Map<symbol, any>();

  nodeIdGenerator = new SyntaxNodeIdGenerator();

  symbolIdGenerator = new NodeSymbolIdGenerator();
  symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  setSource (source: string) {
    this.source = source;
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
  bind = this.query(bind);

  nodeSymbol = this.query(nodeSymbol);
  symbolMembers = this.query(symbolMembers);
  lookupMembers = this.query(lookupMembers);

  symbolReferences = this.query(symbolReferences);
  nodeReferee = this.query(nodeReferee);

  interpret = this.query(interpret);
  interpretFile = this.query(interpretFile);

  // local queries
  parseFile = this.query(parseFile);
  validate = this.query(validate);
  fullname = this.query(fullname);
  symbolName = this.query(symbolName);
  alias = this.query(alias);
  settings = this.query(settings);

  renameTable (oldName: TableNameInput, newName: TableNameInput): string {
    return renameTable.call(this, oldName, newName);
  }

  // @deprecated - legacy APIs for services compatibility
  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: () => this.source as Readonly<string>,
    _: this.query(interpretFile),
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
