import {
  ref, shallowRef, computed, watch, nextTick,
} from 'vue';
import {
  defineStore,
} from 'pinia';
import {
  debounce,
} from 'lodash-es';
import * as monaco from 'monaco-editor';
import {
  Compiler, DBMLDiagnosticsProvider, Filepath,
} from '@dbml/parse';
import type {
  SyntaxToken, ProgramNode, Database, NodeSymbol,
} from '@dbml/parse';
import {
  DBMLLanguageService,
} from '@/components/monaco/dbml-language';
import type {
  ParserError,
} from '../types';
import logger from '../utils/logger';
import {
  useProject,
} from './projectStore';

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

  return {
    id: sym.id,
    kind: sym.kind,
    name,
    declPos,
    members,
  };
}

function diagnosticToParserError (d: Record<string, unknown>): ParserError {
  return {
    code: typeof d.code === 'number' ? d.code : -1,
    message: String(d.text ?? ''),
    location: {
      line: Number(d.startRow),
      column: Number(d.startColumn),
    },
    endLocation: {
      line: Number(d.endRow),
      column: Number(d.endColumn),
    },
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

  const debouncedParse = debounce((targetFile?: string) => {
    isLoading.value = true;
    const currentFilepath = new Filepath(targetFile ?? project.currentFile);
    try {
      // Load all project files into the compiler
      for (const [path, content] of Object.entries(project.files)) {
        const filepath = new Filepath(path);
        compiler.setSource(filepath, content);
      }

      // Bind the entire project to establish cross-file relationships
      compiler.bindProject();

      // Parse the current file for tokens and AST
      const parseResult = compiler.parseFile(currentFilepath);

      const parseIndex = parseResult.getValue();
      if (parseIndex) {
        tokens.value = [...parseIndex.tokens];
        ast.value = parseIndex.ast as ProgramNode;
      } else {
        tokens.value = [];
        ast.value = null;
      }

      // Errors/warnings are scoped to the current file so Monaco markers only
      // highlight positions that exist in the editor being shown.
      errors.value = (diagnosticsProvider.provideErrors(currentFilepath) as Array<Record<string, unknown>>).map(diagnosticToParserError);

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
        warnings.value = (diagnosticsProvider.provideWarnings(currentFilepath) as Array<Record<string, unknown>>).map(diagnosticToParserError);
      } catch (err) {
        logger.warn('Failed to get warnings:', err);
        warnings.value = [];
      }
      isLoading.value = false;
    }
  }, DEBOUNCE_MS);

  // Watch both files and currentFile to trigger reparse when project changes
  watch(() => project.files, () => {
    const file = project.currentFile;
    debouncedParse(file);
  }, {
    deep: true,
  });

  watch(() => project.currentFile, (newFile) => {
    debouncedParse(newFile);
  });

  // Defer the initial parse until after all components have mounted so the
  // store is not running heavy compilation work before the UI is ready.
  nextTick(() => debouncedParse(project.currentFile));

  // Stable proxy objects whose internal delegates are swapped on each setupMonacoServices call.
  // Monaco provider registration is permanent (cannot be re-registered), so we register once using
  // these proxies and update the delegates to point at the current Compiler's services whenever the
  // store creates a new Compiler instance (e.g. on hot-reload or test teardown).
  type MonacoServices = Awaited<ReturnType<Compiler['initMonacoServices']>>;
  let currentServices: MonacoServices | null = null;
  let areServicesRegistered = false;
  const languageId = DBMLLanguageService.getLanguageId();

  async function setupMonacoServices (_editor: monaco.editor.IStandaloneCodeEditor) {
    try {
      currentServices = await compiler.initMonacoServices();
      if (areServicesRegistered) return;
      areServicesRegistered = true;
      monaco.languages.registerDefinitionProvider(languageId, {
        provideDefinition: (...args) => currentServices?.definitionProvider.provideDefinition(...args) ?? null,
      });
      monaco.languages.registerReferenceProvider(languageId, {
        provideReferences: (...args) => currentServices?.referenceProvider.provideReferences(...args) ?? [],
      });
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: (...args) => currentServices?.autocompletionProvider.provideCompletionItems(...args) ?? { suggestions: [] },
      });
    } catch (err) {
      logger.warn('Failed to register Monaco language services:', err);
    }
  }

  function updateDiagnostics (model: monaco.editor.ITextModel): void {
    if (!currentServices) return;
    const markers = (currentServices.diagnosticsProvider as { provideMarkers(): monaco.editor.IMarkerData[] }).provideMarkers();
    monaco.editor.setModelMarkers(model, languageId, markers);
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
    updateDiagnostics,
  };
});
