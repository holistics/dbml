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
  Compiler, DBMLDiagnosticsProvider, Filepath, UNHANDLED,
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
  declFilepath: string | null;
  members: SymbolInfo[];
}

function getSymbolMembers (compiler: Compiler, sym: NodeSymbol): NodeSymbol[] {
  try {
    const value = compiler.symbolMembers(sym).getFiltered(UNHANDLED);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function buildSymbolInfo (compiler: Compiler, sym: NodeSymbol, depth = 0): SymbolInfo {
  const name = sym.name ?? `#${sym.id}`;
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
    declFilepath: decl?.filepath?.absolute ?? null,
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
    const currentFilepath = Filepath.fromUri(monaco.Uri.file(targetFile ?? project.currentFile).toString());
    try {
      // Load all project files into the compiler. Go through Filepath.fromUri
      // using the same `file://` URIs Monaco builds for editor models — this
      // way Filepath carries a 'file:' protocol and `toUri()` on declarations
      // produces URIs that match the models' URIs, so Ctrl+Click go-to-def
      // resolves into the correct Monaco model instead of failing silently.
      for (const [path, content] of Object.entries(project.files)) {
        const filepath = Filepath.fromUri(monaco.Uri.file(path).toString());
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
      errors.value = (diagnosticsProvider.provideErrors(currentFilepath) as any[]).map(diagnosticToParserError);

      // exportSchemaJson returns the current file's schema reconciled against
      // its imports (externals, alias rename, cross-file refs/records). Using
      // the legacy `parse.rawDb()` hardcodes DEFAULT_ENTRY, so switching to a
      // non-default file left the Database tab empty.
      database.value = compiler.exportSchemaJson(currentFilepath).getValue() as Database | undefined ?? null;

      // Root the tree at the ProgramSymbol so the tab shows every schema and
      // their nested members — the old `publicSymbolTable` returned a flat
      // top-level list only.
      const programSymbol = parseIndex ? compiler.nodeSymbol(parseIndex.ast).getFiltered(UNHANDLED) : undefined;
      symbols.value = programSymbol ? [buildSymbolInfo(compiler, programSymbol)] : [];
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
        warnings.value = (diagnosticsProvider.provideWarnings(currentFilepath) as any[]).map(diagnosticToParserError);
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
      // Register the providers directly so that
      // Monaco's own feature lookup finds provideDefinition / provideReferences /
      // provideCompletionItems as own methods on the provider object. The
      // previous wrapper indirection registered a bare literal, which Monaco's
      // provider registry accepted, but some internals check the method with
      // `own`-property semantics and silently skipped the provider.
      // @dbml/parse types against monaco-editor-core while this bundle pulls
      // monaco-editor — structurally compatible at runtime, separate type
      // surfaces at compile time.
      monaco.languages.registerDefinitionProvider(languageId, currentServices.definitionProvider as any);
      monaco.languages.registerReferenceProvider(languageId, currentServices.referenceProvider as any);
      monaco.languages.registerCompletionItemProvider(languageId, currentServices.autocompletionProvider as any);
    } catch (err) {
      logger.warn('Failed to register Monaco language services:', err);
    }
  }

  function updateDiagnostics (model: monaco.editor.ITextModel): void {
    if (!currentServices) return;
    const fp = model.uri ? Filepath.fromUri(String(model.uri)) : undefined;
    const markers = (currentServices.diagnosticsProvider as { provideMarkers(f?: Filepath): monaco.editor.IMarkerData[] }).provideMarkers(fp);
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
