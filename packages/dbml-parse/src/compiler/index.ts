import {
  DEFAULT_ENTRY,
} from '@/constants';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import {
  NodeSymbolIdGenerator,
} from '@/core/types/symbol/symbols';
import {
  DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLDiagnosticsProvider, DBMLReferencesProvider,
} from '@/services/index';
import {
  containerElement, containerScope, containerScopeKind, containerStack, containerToken,
} from './queries/container';
import {
  ast, errors, publicSymbolTable, rawDb, tokens, warnings,
} from './queries/legacy/parse';
import {
  symbolMembers, symbolOfName, symbolOfNameToKey,
} from './queries/legacy/symbol';
import {
  flatStream, invalidStream,
} from './queries/legacy/token';
import {
  interpretFile,
} from './queries/pipeline/interpret';
import {
  parseFile,
} from './queries/pipeline/parse';
import {
  type DiagramViewBlock,
  type DiagramViewSyncOperation,
  type TableNameInput,
  type TextEdit,
  applyTextEdits,
  findDiagramViewBlocks,
  renameTable,
  syncDiagramView,
} from './queries/transform';
import {
  addDoubleQuoteIfNeeded, escapeString, formatRecordValue, isValidIdentifier, splitQualifiedIdentifier, unescapeString,
} from './queries/utils';
import {
  SymbolFactory,
} from '@/core/types';
import {
  DbmlProjectLayout, MemoryProjectLayout,
} from './projectLayout';

// Re-export types
export {
  ScopeKind,
} from './types';
export type {
  TextEdit, TableNameInput, DiagramViewSyncOperation, DiagramViewBlock,
};

// Re-export utilities
export {
  splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded,
};

export default class Compiler {
  // Interners
  nodeIdGenerator = new SyntaxNodeIdGenerator();
  symbolIdGenerator = new NodeSymbolIdGenerator();
  symbolFactory = new SymbolFactory(this.symbolIdGenerator);

  // The structure of the DbmlProject
  layout: DbmlProjectLayout = new MemoryProjectLayout();

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

  private cache = new Map<symbol, any>();

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

  renameTable (
    filepath: Filepath,
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, filepath, oldName, newName);
  }

  syncDiagramView (
    operations: DiagramViewSyncOperation[],
    blocks?: DiagramViewBlock[],
  ): { newDbml: string;
    edits: TextEdit[]; } {
    return syncDiagramView(this.parse.source(DEFAULT_ENTRY), operations, blocks);
  }

  findDiagramViewBlocks (): DiagramViewBlock[] {
    return findDiagramViewBlocks(this.parse.source(DEFAULT_ENTRY));
  }

  applyTextEdits (edits: TextEdit[]): string {
    return applyTextEdits(this.parse.source(DEFAULT_ENTRY), edits);
  }

  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  parseFile = this.query(parseFile);

  interpretFile = this.query(interpretFile);

  // @deprecated - legacy APIs for services compatibility
  readonly parse = {
    source: (filepath: Filepath) => this.layout.getSource(filepath) as Readonly<string>,
    ast: this.query(ast),
    errors: this.query(errors),
    warnings: this.query(warnings),
    tokens: this.query(tokens),
    rawDb: this.query(rawDb),
    publicSymbolTable: this.query(publicSymbolTable),
  };

  readonly symbol = {
    ofName: this.query(symbolOfName, symbolOfNameToKey),
    members: this.query(symbolMembers),
  };

  // @deprecated - legacy APIs for services compatibility
  readonly container = {
    stack: this.query(containerStack),
    token: this.query(containerToken),
    element: this.query(containerElement),
    scope: this.query(containerScope),
    scopeKind: this.query(containerScopeKind),
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
