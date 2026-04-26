import {
  DEFAULT_ENTRY,
} from '@/constants';
import Analyzer from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  ProgramNode, SyntaxNodeIdGenerator,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  Database,
} from '@/core/types/schemaJson';
import {
  NodeSymbolIdGenerator,
} from '@/core/types/symbol/symbols';
import {
  SyntaxToken,
} from '@/core/types/tokens';
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
  private symbolIdGenerator = new NodeSymbolIdGenerator();
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

  private interpret (): Report<{
    ast: ProgramNode;
    tokens: SyntaxToken[];
    rawDb?: Database;
  }> {
    const filepath = DEFAULT_ENTRY;
    const parseRes: Report<{
      ast: ProgramNode;
      tokens: SyntaxToken[];
    }> = new Lexer(this.source, filepath)
      .lex()
      .chain((lexedTokens) => new Parser(this.source, lexedTokens as SyntaxToken[], this.nodeIdGenerator, filepath).parse())
      .chain(({
        ast, tokens,
      }) => new Analyzer(ast, this.symbolIdGenerator).analyze().map(() => ({
        ast,
        tokens,
      })));

    if (parseRes.getErrors().length > 0) {
      return parseRes as Report<{ ast: ProgramNode;
        tokens: SyntaxToken[];
        rawDb?: Database; }>;
    }

    return parseRes.chain(({
      ast, tokens,
    }) =>
      new Interpreter(ast).interpret().map((rawDb) => ({
        ast,
        tokens,
        rawDb,
      })),
    );
  }

  renameTable (
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, oldName, newName);
  }

  syncDiagramView (
    operations: DiagramViewSyncOperation[],
    blocks?: DiagramViewBlock[],
  ): { newDbml: string;
    edits: TextEdit[]; } {
    return syncDiagramView(this.parse.source(), operations, blocks);
  }

  findDiagramViewBlocks (): DiagramViewBlock[] {
    return findDiagramViewBlocks(this.parse.source());
  }

  applyTextEdits (edits: TextEdit[]): string {
    return applyTextEdits(this.parse.source(), edits);
  }

  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  parseFile = this.query(parseFile);

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
