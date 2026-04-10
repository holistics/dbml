import { ref, shallowRef, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { debounce } from 'lodash-es';
import * as monaco from 'monaco-editor';
import { Compiler, DBMLDiagnosticsProvider } from '@dbml/parse';
import type { SyntaxToken, ProgramNode, Database, NodeSymbol } from '@dbml/parse';
import { registerLanguageServices } from '@/services/language-services';
import type { ParserError } from '../types';
import logger from '../utils/logger';
import { useProject } from './projectStore';

const DEBOUNCE_MS = 300;

export interface DeclPos {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

// Pre-built symbol descriptor for display — avoids exposing the compiler's
// internal graph (circular `declaration` refs, internal Report types) to UI components.
export interface SymbolInfo {
  id: number;
  kind: string; // SymbolKind value, e.g. 'Table', 'Column', 'Enum'
  name: string;
  declPos: DeclPos | null;
  members: SymbolInfo[];
}

function getSymbolMembers (compiler: Compiler, sym: NodeSymbol): NodeSymbol[] {
  try {
    const result = compiler.symbolMembers(sym);
    const value = result.getValue();
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function buildSymbolInfo (compiler: Compiler, sym: NodeSymbol, depth = 0): SymbolInfo {
  const name = compiler.symbolName(sym) ?? `#${sym.id}`;
  const decl = sym.declaration;
  const sp = decl?.startPos;
  const ep = decl?.endPos;
  const declPos: DeclPos | null = sp && !Number.isNaN(sp.line)
    ? {
        startLine: sp.line + 1,
        startCol: sp.column + 1,
        endLine: ep && !Number.isNaN(ep.line) ? ep.line + 1 : sp.line + 1,
        endCol: ep && !Number.isNaN(ep.line) ? ep.column + 1 : sp.column + 1,
      }
    : null;

  const members = depth < 4
    ? getSymbolMembers(compiler, sym).map((m) => buildSymbolInfo(compiler, m, depth + 1))
    : [];

  return { id: sym.id, kind: sym.kind, name, declPos, members };
}

function diagnosticToParserError (d: Record<string, unknown>): ParserError {
  return {
    code: typeof d.code === 'number' ? d.code : -1,
    message: String(d.text ?? ''),
    location: { line: Number(d.startRow), column: Number(d.startColumn) },
    endLocation: { line: Number(d.endRow), column: Number(d.endColumn) },
  };
}

export const useParser = defineStore('parser', () => {
  const compiler = new Compiler();
  const diagnosticsProvider = new DBMLDiagnosticsProvider(compiler);
  const project = useProject();

  const isLoading = ref(false);
  // shallowRef prevents Vue from deeply proxying objects with circular refs
  // (SyntaxNode.parentNode, NodeSymbol.declaration)
  const tokens = shallowRef<SyntaxToken[]>([]);
  const ast = shallowRef<ProgramNode | null>(null);
  const database = shallowRef<Database | null>(null);
  const symbols = shallowRef<SymbolInfo[]>([]);
  const errors = ref<readonly ParserError[]>([]);
  const warnings = ref<readonly ParserError[]>([]);

  const hasDatabase = computed(() => database.value !== null);

  const debouncedParse = debounce((content: string) => {
    isLoading.value = true;
    try {
      compiler.setSource(content);

      // SyntaxTokenKind.EOF = '<eof>' — filter it out for display
      tokens.value = [...compiler.parse.tokens()].filter((t) => (t.kind as string) !== '<eof>');
      ast.value = compiler.parse.ast() as ProgramNode;

      errors.value = (diagnosticsProvider.provideErrors() as Array<Record<string, unknown>>).map(diagnosticToParserError);

      database.value = errors.value.length === 0
        ? (compiler.parse.rawDb() as Database | undefined ?? null)
        : null;

      const rawSymbols = compiler.parse.publicSymbolTable();
      symbols.value = rawSymbols
        ? [...rawSymbols].map((sym) => buildSymbolInfo(compiler, sym))
        : [];
    } catch (err) {
      logger.error('Unexpected parsing error:', err);
      const message = err instanceof Error ? err.message : 'Unexpected error';
      tokens.value = [];
      ast.value = null;
      database.value = null;
      symbols.value = [];
      errors.value = [{
        code: -1,
        message,
        location: { line: 1, column: 1 },
        endLocation: { line: 1, column: 2 },
      }];
    } finally {
      try {
        warnings.value = (diagnosticsProvider.provideWarnings() as Array<Record<string, unknown>>).map(diagnosticToParserError);
      } catch (err) {
        logger.warn('Failed to get warnings:', err);
        warnings.value = [];
      }
      isLoading.value = false;
    }
  }, DEBOUNCE_MS);

  watch(() => project.currentContent, (content) => {
    debouncedParse(content);
  }, { immediate: true });

  async function setupMonacoServices (_editor: monaco.editor.IStandaloneCodeEditor) {
    try {
      await registerLanguageServices(compiler);
    } catch (err) {
      logger.warn('Failed to register Monaco language services:', err);
    }
  }

  return {
    isLoading,
    tokens,
    ast,
    database,
    hasDatabase,
    symbols,
    errors,
    warnings,
    setupMonacoServices,
  };
});
