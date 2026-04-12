import {
  SyntaxNodeIdGenerator, ProgramNode,
} from '@/core/types/nodes';
import { Filepath } from '@/core/types/filepath';
import { DEFAULT_ENTRY } from '@/constants';
import { NodeSymbolIdGenerator } from '@/core/types/symbol/symbols';
import { SyntaxToken } from '@/core/types/tokens';
import { Database } from '@/core/types/schemaJson';
import Report from '@/core/types/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Analyzer from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';
import {
  DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider,
} from '@/services/index';
import {
  ast, errors, warnings, tokens, rawDb, publicSymbolTable,
} from './queries/parse';
import {
  invalidStream, flatStream,
} from './queries/token';
import {
  symbolOfName, symbolOfNameToKey, symbolMembers,
} from './queries/symbol';
import {
  containerStack, containerToken, containerElement, containerScope, containerScopeKind,
} from './queries/container';
import {
  renameTable,
  applyTextEdits,
  syncDiagramView,
  findDiagramViewBlocks,
  type TextEdit,
  type TableNameInput,
  type DiagramViewSyncOperation,
  type DiagramViewBlock,
} from './queries/transform';
import {
  splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded,
} from './queries/utils';

// Re-export types
export { ScopeKind } from './types';
export type {
  TextEdit, TableNameInput, DiagramViewSyncOperation, DiagramViewBlock,
};

// Re-export utilities
export {
  splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded,
};

export default class Compiler {
  private source = '';
  private cache = new Map<symbol, any>();
  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  setSource (source: string) {
    this.source = source;
    this.cache.clear();
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();
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

  private interpret (): Report<{ ast: ProgramNode;
    tokens: SyntaxToken[];
    rawDb?: Database; }> {
    const filepath = DEFAULT_ENTRY;
    const parseRes: Report<{ ast: ProgramNode;
      tokens: SyntaxToken[]; }> = new Lexer(this.source, filepath)
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

  readonly parse = {
    source: () => this.source as Readonly<string>,
    _: this.query(this.interpret),
    ast: this.query(ast),
    errors: this.query(errors),
    warnings: this.query(warnings),
    tokens: this.query(tokens),
    rawDb: this.query(rawDb),
    publicSymbolTable: this.query(publicSymbolTable),
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
