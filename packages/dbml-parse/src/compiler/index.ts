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
import { type FilepathKey } from './projectLayout';
import { type FileIndex } from './types';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider, DBMLDiagnosticsProvider } from '@/services/index';
import { ast, errors, warnings, tokens, rawDb, publicSymbolTable, nodeToSymbol, nodeToReferee } from './queries/parse';
import { parseFile, parseProject, analyzeProject, interpretProject, nodeSymbol, nodeReferences, nodeReferee } from './queries/project';
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
  private globalCache = new Map<symbol, any>();
  private fileIndexes = new Map<FilepathKey, FileIndex>();
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

    this.globalCache.clear();
    if (filePath === undefined) {
      this.fileIndexes.clear();
    } else {
      this.fileIndexes.delete(filePath.key);
    }
    return this;
  }

  private localQuery (fn: (this: Compiler, filepath: Filepath) => FileIndex): (filepath: Filepath) => FileIndex {
    return (filepath: Filepath): FileIndex => {
      const cached = this.fileIndexes.get(filepath.key);
      if (cached) return cached;
      const result = fn.call(this, filepath);
      this.fileIndexes.set(filepath.key, result);
      return result;
    };
  }

  private globalQuery<Args extends unknown[], Return> (
    fn: (this: Compiler, ...args: Args) => Return,
    toKey?: (...args: Args) => unknown,
  ): (...args: Args) => Return {
    const cacheKey = Symbol();
    return ((...args: Args): Return => {
      if (args.length === 0) {
        if (this.globalCache.has(cacheKey)) return this.globalCache.get(cacheKey);
        const result = fn.apply(this, args);
        this.globalCache.set(cacheKey, result);
        return result;
      }

      const key = toKey ? toKey(...args) : args[0];
      let mapCache = this.globalCache.get(cacheKey);
      if (mapCache instanceof Map && mapCache.has(key)) return mapCache.get(key);

      const result = fn.apply(this, args);
      if (!(mapCache instanceof Map)) {
        mapCache = new Map();
        this.globalCache.set(cacheKey, mapCache);
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

  deleteSource (filePath: Filepath): this {
    this.layout.deleteSource(filePath);
    this.globalCache.clear();
    this.fileIndexes.delete(filePath.key);
    return this;
  }

  clearSource (): this {
    this.layout.clearSource();
    this.globalCache.clear();
    this.fileIndexes.clear();
    return this;
  }

  renameTable (
    oldName: TableNameInput,
    newName: TableNameInput,
  ): string {
    return renameTable.call(this, oldName, newName);
  }

  applyTextEdits (edits: TextEdit[]): string {
    // FIXME
    return '';
  }

  parseFile = this.localQuery(parseFile);
  parseProject = parseProject.bind(this);
  analyzeProject = this.globalQuery(analyzeProject);
  interpretProject = this.globalQuery(interpretProject);
  nodeSymbol = this.globalQuery(nodeSymbol);
  nodeReferences = this.globalQuery(nodeReferences);
  nodeReferee = this.globalQuery(nodeReferee);

  initMonacoServices () {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
      diagnosticsProvider: new DBMLDiagnosticsProvider(this),
    };
  }
}
