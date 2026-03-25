import { SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { ast, errors, warnings, tokens, rawDb, publicSymbolTable, symbolToReferences } from './queries/parse';
import { invalidStream, flatStream } from './queries/token';
import { symbolOfName, symbolOfNameToKey, symbolMembers } from './queries/symbol';
import { containerStack, containerToken, containerElement, containerScope, containerScopeKind } from './queries/container';
import {
  renameTable,
  applyTextEdits,
  type TextEdit,
  type TableNameInput,
} from './queries/transform';
import { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded } from './queries/utils';
import { parseFile, analyzeFile, interpretFile } from './queries/pipeline';

// Re-export types
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput };

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

export default class Compiler {
  private source = '';
  private cache = new Map<symbol, any>();

  setSource (source: string) {
    this.source = source;
    this.cache.clear();
  }

  private query<Args extends unknown[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
    toKey?: (...args: Args) => unknown,
  ): (...args: Args) => Return {
    const cacheKey = Symbol();
    return ((...args: Args): Return => {
      if (args.length === 0) {
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        const result = fn.apply(this, args);
        this.cache.set(cacheKey, result);
        return result;
      }

      const key = toKey ? toKey(...args) : args[0];
      let mapCache = this.cache.get(cacheKey);
      if (mapCache instanceof Map && mapCache.has(key)) return mapCache.get(key);

      const result = fn.apply(this, args);
      if (!(mapCache instanceof Map)) {
        mapCache = new Map();
        this.cache.set(cacheKey, mapCache);
      }
      mapCache.set(key, result);
      return result;
    }) as (...args: Args) => Return;
  }

  parseFile = this.query(parseFile);
  analyzeFile = this.query(analyzeFile);

  resolvedSymbol (node: SyntaxNode): NodeSymbol | undefined {
    return this.analyzeFile().getValue().nodeToSymbol.get(node);
  }

  nodeReferee (node: SyntaxNode): NodeSymbol | undefined {
    return this.analyzeFile().getValue().nodeToReferee.get(node);
  }

  nodeReferences (nodeOrSymbol: SyntaxNode | NodeSymbol): SyntaxNode[] {
    const { nodeToSymbol, symbolToReferences } = this.analyzeFile().getValue();
    const symbol = nodeOrSymbol instanceof SyntaxNode ? nodeToSymbol.get(nodeOrSymbol) : nodeOrSymbol;
    if (!symbol) return [];
    return symbolToReferences.get(symbol) ?? [];
  }

  renameTable (
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, oldName, newName);
  }

  applyTextEdits (edits: TextEdit[]): string {
    return applyTextEdits(this.parse.source(), edits);
  }

  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  readonly parse = {
    source: () => this.source as Readonly<string>,
    _: this.query(interpretFile),
    ast: this.query(ast),
    errors: this.query(errors),
    warnings: this.query(warnings),
    tokens: this.query(tokens),
    rawDb: this.query(rawDb),
    publicSymbolTable: this.query(publicSymbolTable),
    symbolToReferences: this.query(symbolToReferences),
  };

  readonly container = {
    stack: this.query(containerStack),
    token: this.query(containerToken),
    element: this.query(containerElement),
    scope: this.query(containerScope),
    scopeKind: this.query(containerScopeKind),
  };

  readonly symbol = {
    ofName: this.query(symbolOfName, symbolOfNameToKey),
    members: this.query(symbolMembers),
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
