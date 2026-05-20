import {
  ref, shallowRef, computed, watch, nextTick,
} from 'vue';
import { defineStore } from 'pinia';
import { debounce } from 'lodash-es';
import * as monaco from 'monaco-editor';
import {
  Compiler, DBMLDiagnosticsProvider, Filepath, MemoryProjectLayout,
} from '@dbml/parse';
import type {
  Diagnostic, SyntaxToken, ProgramNode, Database, NodeSymbol,
} from '@dbml/parse';
import type { ParserError } from '../types';
import { toMonacoRange } from '../utils/monaco';
import logger from '../utils/logger';
import { useProjectStore } from './projectStore';

const DEBOUNCE_MS = 300;

export interface DeclarationPosition {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// Breaks circular references in compiler symbols for safe Vue reactivity.
export interface SymbolInfo {
  id: number;
  kind: string;
  name: string;
  declarationPosition?: DeclarationPosition;
  declarationFilepath?: string;
  members: SymbolInfo[];
}

function getSymbolMembers (compiler: Compiler, symbol: NodeSymbol): NodeSymbol[] {
  try {
    const members = compiler.symbolMembers(symbol);
    return Array.isArray(members) ? members.map((m) => m.symbol) : [];
  } catch {
    return [];
  }
}

function buildSymbolInfo (compiler: Compiler, symbol: NodeSymbol, depth = 0): SymbolInfo {
  const name = symbol.name ?? `#${symbol.id}`;
  const declaration = symbol.declaration;
  const startPos = declaration?.startPos;
  const endPos = declaration?.endPos;
  let declarationPosition: DeclarationPosition | undefined;
  if (startPos && !Number.isNaN(startPos.line)) {
    const range = toMonacoRange(startPos, endPos);
    declarationPosition = {
      startLine: range.startLineNumber,
      startColumn: range.startColumn,
      endLine: range.endLineNumber,
      endColumn: range.endColumn,
    };
  }

  const members = depth < 4
    ? getSymbolMembers(compiler, symbol).map((m) => buildSymbolInfo(compiler, m, depth + 1))
    : [];

  return {
    id: symbol.id,
    kind: symbol.kind,
    name,
    declarationPosition,
    declarationFilepath: declaration?.filepath?.absolute,
    members,
  };
}

function toParserError (diagnostic: Diagnostic): ParserError {
  return {
    code: diagnostic.code ?? -1,
    message: String(diagnostic.text ?? ''),
    location: {
      line: Number(diagnostic.startRow),
      column: Number(diagnostic.startColumn),
    },
    endLocation: {
      line: Number(diagnostic.endRow),
      column: Number(diagnostic.endColumn),
    },
  };
}

export const useParserStore = defineStore('parser', () => {
  const layout = new MemoryProjectLayout();
  const compiler = new Compiler(layout);
  const diagnosticsProvider = new DBMLDiagnosticsProvider(compiler);
  const project = useProjectStore();

  const isLoading = ref(false);

  const tokens = shallowRef<SyntaxToken[]>([]);
  const ast = shallowRef<ProgramNode>();
  const database = shallowRef<Database>();
  const symbols = shallowRef<SymbolInfo[]>([]);
  const errors = ref<readonly ParserError[]>([]);
  const warnings = ref<readonly ParserError[]>([]);

  const hasDatabase = computed(() => database.value !== undefined);

  // Tracks which file paths the compiler currently holds so we can
  // remove paths that disappear from the project store.
  const loadedFilepaths = new Set<string>();

  const debouncedParse = debounce((targetFile?: string) => {
    isLoading.value = true;
    const currentFilepath = Filepath.fromUri(monaco.Uri.file(targetFile ?? project.currentFile).toString());
    try {
      // Drop files the compiler holds that no longer exist in the project
      const currentPaths = new Set(Object.keys(project.files));
      for (const loadedPath of loadedFilepaths) {
        if (!currentPaths.has(loadedPath)) {
          const fp = Filepath.fromUri(monaco.Uri.file(loadedPath).toString());
          layout.deleteSource(fp);
          loadedFilepaths.delete(loadedPath);
        }
      }

      // Load all project files into the compiler via file:// URIs
      // so go-to-def resolves into the correct Monaco model.
      for (const [path, content] of Object.entries(project.files)) {
        const filepath = Filepath.fromUri(monaco.Uri.file(path).toString());
        layout.setSource(filepath, content);
        loadedFilepaths.add(path);
      }

      const parseResult = compiler.parseFile(currentFilepath);
      const parseIndex = parseResult.getValue();
      if (parseIndex) {
        tokens.value = [...parseIndex.tokens];
        ast.value = parseIndex.ast as ProgramNode;
      } else {
        tokens.value = [];
        ast.value = undefined;
      }

      errors.value = (diagnosticsProvider.provideErrors(currentFilepath) as Diagnostic[]).filter((d) => d.filepath.equals(currentFilepath)).map(toParserError);
      database.value = compiler.interpretFile(currentFilepath).getValue() as Database | undefined;

      const programSymbol = parseIndex?.ast?.symbol;
      symbols.value = programSymbol ? [buildSymbolInfo(compiler, programSymbol)] : [];
    } catch (err) {
      logger.error('Unexpected parsing error');
      const message = err instanceof Error ? err.message : 'Unexpected error';
      tokens.value = [];
      ast.value = undefined;
      database.value = undefined;
      symbols.value = [];
      errors.value = [{
        code: -1,
        message,
        location: {
          line: 1,
          column: 1,
        },
        endLocation: {
          line: 1,
          column: 2,
        },
      }];
    } finally {
      try {
        warnings.value = (diagnosticsProvider.provideWarnings(currentFilepath) as Diagnostic[]).filter((d) => d.filepath.equals(currentFilepath)).map(toParserError);
      } catch (_err) {
        logger.warn('Failed to get warnings');
        warnings.value = [];
      }
      isLoading.value = false;
    }
  }, DEBOUNCE_MS);

  watch(() => project.files, () => {
    debouncedParse(project.currentFile);
  }, {
    deep: true,
  });

  watch(() => project.currentFile, (newFile) => {
    debouncedParse(newFile);
  });

  nextTick(() => debouncedParse(project.currentFile));

  return {
    compiler,
    isLoading,
    tokens,
    ast,
    database,
    hasDatabase,
    symbols,
    errors,
    warnings,
  };
});
