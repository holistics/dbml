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
  Diagnostic, SyntaxToken, ProgramNode, Database, NodeSymbol,
} from '@dbml/parse';
import {
  DBMLLanguageService,
} from '@/components/editor/dbml-language';
import type {
  ParserError,
} from '../types';
import {
  toMonacoRange,
} from '../utils/monaco';
import logger from '../utils/logger';
import {
  useProjectStore,
} from './projectStore';

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
  const compiler = new Compiler();
  const diagnosticsProvider = new DBMLDiagnosticsProvider(compiler);
  const project = useProjectStore();

  const isLoading = ref(false);
  // shallowRef prevents Vue from deeply proxying objects with circular refs
  // (SyntaxNode.parentNode, NodeSymbol.declaration)
  const tokens = shallowRef<SyntaxToken[]>([]);
  const ast = shallowRef<ProgramNode>();
  const database = shallowRef<Database>();
  const symbols = shallowRef<SymbolInfo[]>([]);
  const errors = ref<readonly ParserError[]>([]);
  const warnings = ref<readonly ParserError[]>([]);

  const hasDatabase = computed(() => database.value !== undefined);

  // Tracks which file paths the compiler's project layout currently holds, so
  // we can send deleteSource for paths that disappear from the project store.
  const loadedFilepaths = new Set<string>();

  const debouncedParse = debounce((targetFile?: string) => {
    isLoading.value = true;
    const currentFilepath = Filepath.fromUri(monaco.Uri.file(targetFile ?? project.currentFile).toString());
    try {
      // Drop any files the compiler holds that no longer exist in the project
      // store (renames show up as delete-old + add-new). setSource handles the
      // rest  -- it invalidates per-file cache and refreshes existing entries.
      const currentPaths = new Set(Object.keys(project.files));
      for (const loadedPath of loadedFilepaths) {
        if (!currentPaths.has(loadedPath)) {
          compiler.deleteSource(Filepath.fromUri(monaco.Uri.file(loadedPath).toString()));
          loadedFilepaths.delete(loadedPath);
        }
      }

      // Load all project files into the compiler. Go through Filepath.fromUri
      // using the same `file://` URIs Monaco builds for editor models  -- this
      // way Filepath carries a 'file:' protocol and `toUri()` on declarations
      // produces URIs that match the models' URIs, so Ctrl+Click go-to-def
      // resolves into the correct Monaco model instead of failing silently.
      for (const [path, content] of Object.entries(project.files)) {
        const filepath = Filepath.fromUri(monaco.Uri.file(path).toString());
        compiler.setSource(filepath, content);
        loadedFilepaths.add(path);
      }

      // Parse and bind the current file (bindFile is called transitively
      // by interpretFile, so a standalone bindProject call is not needed).
      const parseResult = compiler.parseFile(currentFilepath);

      const parseIndex = parseResult.getValue();
      if (parseIndex) {
        tokens.value = [...parseIndex.tokens];
        ast.value = parseIndex.ast as ProgramNode;
      } else {
        tokens.value = [];
        ast.value = undefined;
      }

      // Errors/warnings are scoped to the current file so Monaco markers only
      // highlight positions that exist in the editor being shown.
      errors.value = (diagnosticsProvider.provideErrors(currentFilepath) as Diagnostic[]).map(toParserError);

      // interpretFile runs the full pipeline (parse -> validate -> bind ->
      // interpret) for the current file and returns the Database schema.
      database.value = compiler.interpretFile(currentFilepath).getValue() as Database | undefined;

      // Root the tree at the ProgramSymbol so the tab shows every schema
      // and their nested members.
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
        warnings.value = (diagnosticsProvider.provideWarnings(currentFilepath) as Diagnostic[]).map(toParserError);
      } catch (_err) {
        logger.warn('Failed to get warnings');
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
  let currentServices: MonacoServices | undefined;
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
      // monaco-editor  -- structurally compatible at runtime, separate type
      // surfaces at compile time.
      // Wrap the language-service calls so we always push the editor's
      // current text into the compiler before any analysis runs. The parse
      // store is debounced (300 ms), so without this the providers see a
      // stale snapshot and misclassify the cursor  -- e.g. returning top-level
      // element-type suggestions after a `.` in a ref or right after `use `.
      const syncCompilerFromModel = (model: monaco.editor.ITextModel) => {
        if (!model.uri) return;
        const filepath = Filepath.fromUri(String(model.uri));
        compiler.setSource(filepath, model.getValue());
      };

      monaco.languages.registerDefinitionProvider(languageId, {
        provideDefinition: (model, position, token) => {
          syncCompilerFromModel(model);
          return (currentServices!.definitionProvider as any).provideDefinition(model, position, token);
        },
      });
      monaco.languages.registerReferenceProvider(languageId, {
        provideReferences: (model, position, context, token) => {
          syncCompilerFromModel(model);
          return (currentServices!.referenceProvider as any).provideReferences(model, position, context, token);
        },
      });
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: (currentServices.autocompletionProvider as any).triggerCharacters,
        provideCompletionItems: (model, position, context, token) => {
          syncCompilerFromModel(model);
          return (currentServices!.autocompletionProvider as any).provideCompletionItems(model, position, context, token);
        },
      });
    } catch (_err) {
      logger.warn('Failed to register Monaco language services');
    }
  }

  function updateDiagnostics (model: monaco.editor.ITextModel): void {
    if (!currentServices) return;
    const filepath = model.uri ? Filepath.fromUri(String(model.uri)) : undefined;
    const markers = (currentServices.diagnosticsProvider as { provideMarkers(f?: Filepath): monaco.editor.IMarkerData[] }).provideMarkers(filepath);
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
