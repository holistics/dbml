import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { invalidStream, flatStream } from './queries/token';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';
import { parseFile } from './queries/pipeline';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
import { renameTable, type TableNameInput } from './queries/transform';
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput } from './queries/transform';
import {
  nodeSymbol,
  symbolMembers,
  nodeReferee,
  nestedSymbols,
  bind,
  interpret,
} from '@/core/global_modules';
import { symbolReferences } from './queries/symbolReferences';
import { intern, type Internable, type Primitive } from '@/core/types/internable';
import { DEFAULT_ENTRY, DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { alias, nodeFullname as fullname, settings, validate } from '@/core/local_modules';
import { NodeSymbolIdGenerator, SchemaSymbol, type NodeSymbol } from '@/core/types/symbols';
import SymbolFactory from '@/core/types/symbolFactory';
import { lookupMembers } from './queries/lookupMembers';
import { symbolName } from './queries/symbolName';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import { type DbmlProjectLayout, MemoryProjectLayout } from './projectLayout';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

const COMPUTING = Symbol('COMPUTING');

export default class Compiler {
  private cache = new Map<symbol, any>();

  layout: DbmlProjectLayout = new MemoryProjectLayout();

  nodeIdGenerator = new SyntaxNodeIdGenerator();

  symbolIdGenerator = new NodeSymbolIdGenerator();
  symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  setSource (layout: DbmlProjectLayout) {
    this.layout = layout;
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

  parseFile = this.query(parseFile);
  nodeSymbol = this.query(nodeSymbol);
  symbolMembers = this.query(symbolMembers);
  lookupMembers = this.query(lookupMembers);
  symbolReferences = this.query(symbolReferences);
  nodeReferee = this.query(nodeReferee);
  nestedSymbols = this.query(nestedSymbols);
  bind = this.query(bind);
  interpret = this.query(interpret);

  renameTable (oldName: TableNameInput, newName: TableNameInput): string {
    return renameTable.call(this, oldName, newName);
  }

  validate = this.query(validate);
  fullname = this.query(fullname);
  symbolName = this.query(symbolName);
  alias = this.query(alias);
  settings = this.query(settings);

  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: () => this.layout.getSource(DEFAULT_ENTRY),
    ast: () => this.parseFile(DEFAULT_ENTRY).getValue().ast,
    _: () => {
      const ast = this.parseFile(DEFAULT_ENTRY).getValue().ast;
      this.bind(ast);
      return this.interpret(ast);
    },
    publicSymbolTable: () => {
      const ast = this.parseFile(DEFAULT_ENTRY).getValue().ast;
      const sym = this.nodeSymbol(ast);
      if (sym.hasValue(UNHANDLED)) return undefined;
      const programMembers = this.symbolMembers(sym.getValue());
      if (programMembers.hasValue(UNHANDLED)) return undefined;

      // Program symbolMembers flattens public schema, but we also need non-public schema contents
      const result: NodeSymbol[] = [];
      for (const member of programMembers.getValue()) {
        result.push(member);
        if (member instanceof SchemaSymbol && member.name !== DEFAULT_SCHEMA_NAME) {
          const schemaMembers = this.symbolMembers(member);
          if (!schemaMembers.hasValue(UNHANDLED)) {
            result.push(...schemaMembers.getValue());
          }
        }
      }
      return result;
    },
  };

  // @deprecated
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
