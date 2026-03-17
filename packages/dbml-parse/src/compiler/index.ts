import { SyntaxNodeIdGenerator, ProgramNode } from '@/core/parser/nodes';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';
import { SyntaxToken } from '@/core/lexer/tokens';
import { Database } from '@/core/interpreter/types';
import Report from '@/core/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Analyzer, { NodeToSymbolMap, NodeToRefereeMap } from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';
import { type DbmlProjectLayout, Filepath, MemoryProjectLayout } from './projectLayout';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { ast, errors, warnings, tokens, rawDb, publicSymbolTable, nodeToSymbol, nodeToReferee } from './queries/parse';
import { parseFile, parseProject, analyzeProject, interpretProject } from './queries/project';
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

// Re-export types
export { ScopeKind } from './types';
export type { TextEdit, TableNameInput };
export type { FileIndex } from './types';

// Re-export utilities
export { splitQualifiedIdentifier, unescapeString, escapeString, formatRecordValue, isValidIdentifier, addDoubleQuoteIfNeeded };

const DEFAULT_ENTRY = Filepath.from('/main.project.dbml');

export default class Compiler {
  private layout: DbmlProjectLayout;
  private cache = new Map<symbol, any>();
  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  constructor (layout?: DbmlProjectLayout) {
    this.layout = layout ?? new MemoryProjectLayout();
  }

  setSource (source: string, filePath?: Filepath): this {
    if (filePath === undefined) {
      // No filepath - reset to a clean single-file layout
      this.layout = new MemoryProjectLayout({ [DEFAULT_ENTRY.key]: source });
    } else {
      this.layout.setSource(filePath, source);
    }
    this.cache.clear();
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();
    return this;
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

  private interpret (): Report<{ ast: ProgramNode; tokens: SyntaxToken[]; rawDb?: Database; nodeToSymbol: NodeToSymbolMap; nodeToReferee: NodeToRefereeMap }> {
    const source = this.layout.getSource(DEFAULT_ENTRY) ?? '';

    const parseRes = new Lexer(source)
      .lex()
      .chain((lexedTokens) => new Parser(source, lexedTokens as SyntaxToken[], this.nodeIdGenerator).parse())
      .chain(({ ast, tokens }) => new Analyzer(ast, this.symbolIdGenerator).analyze().map((analysis) => ({ ...analysis, tokens })));

    if (parseRes.getErrors().length > 0) {
      return parseRes as any;
    }

    return parseRes.chain((analysis) =>
      new Interpreter(analysis).interpret().map((rawDb) => ({ ...analysis, rawDb })),
    );
  }

  renameTable (
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, oldName, newName);
  }

  applyTextEdits (edits: TextEdit[]): string {
    return applyTextEdits(this.parse.source() ?? '', edits);
  }

  parseFile = parseFile.bind(this);
  parseProject = parseProject.bind(this);
  analyzeProject = analyzeProject.bind(this);
  interpretProject = interpretProject.bind(this);

  readonly token = {
    invalidStream: this.query(invalidStream),
    flatStream: this.query(flatStream),
  };

  readonly parse = {
    source: (filepath: Filepath = DEFAULT_ENTRY) => this.layout.getSource(filepath),
    layout: () => this.layout,
    _: this.query(this.interpret),
    ast: this.query(ast),
    errors: this.query(errors),
    warnings: this.query(warnings),
    tokens: this.query(tokens),
    rawDb: this.query(rawDb),
    publicSymbolTable: this.query(publicSymbolTable),
    nodeToSymbol: this.query(nodeToSymbol),
    nodeToReferee: this.query(nodeToReferee),
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
