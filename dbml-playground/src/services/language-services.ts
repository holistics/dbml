import logger from '@/utils/logger';
import * as monaco from 'monaco-editor';
import type { Compiler } from '@dbml/parse';
import {
  dbmlMonarchTokensProvider, dbmlLanguageConfig,
} from '@dbml/parse';

const DBML_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    {
      token: 'keyword',
      foreground: '0000ff',
      fontStyle: 'bold',
    },
    {
      token: 'type',
      foreground: '008000',
      fontStyle: 'bold',
    },
    {
      token: 'string',
      foreground: 'a31515',
    },
    {
      token: 'string.backtick',
      foreground: 'a31515',
      fontStyle: 'italic',
    },
    {
      token: 'comment',
      foreground: '008000',
      fontStyle: 'italic',
    },
    {
      token: 'number',
      foreground: '098658',
    },
    {
      token: 'number.hex',
      foreground: '3030c0',
    },
    {
      token: 'operator',
      foreground: '000000',
    },
    {
      token: 'delimiter',
      foreground: '000000',
    },
    {
      token: 'annotation',
      foreground: '808080',
    },
    {
      token: 'identifier',
      foreground: '000000',
    },
    {
      token: 'string.key.json',
      foreground: '0451a5',
    },
    {
      token: 'string.value.json',
      foreground: 'a31515',
    },
    {
      token: 'number.json',
      foreground: '098658',
    },
    {
      token: 'keyword.json',
      foreground: '0000ff',
    },
  ],
  colors: {},
};

export const DBML_LANGUAGE_ID = 'dbml';
export const DBML_THEME_NAME = 'dbml-theme';

let isLanguageRegistered = false;

export function registerDbmlLanguage (): void {
  if (isLanguageRegistered) return;
  try {
    monaco.languages.register({ id: DBML_LANGUAGE_ID });
    monaco.languages.setMonarchTokensProvider(DBML_LANGUAGE_ID, dbmlMonarchTokensProvider as monaco.languages.IMonarchLanguage);
    monaco.languages.setLanguageConfiguration(DBML_LANGUAGE_ID, dbmlLanguageConfig);
    monaco.editor.defineTheme(DBML_THEME_NAME, DBML_THEME);
    isLanguageRegistered = true;
  } catch (error) {
    logger.warn('Failed to register DBML language:', error);
  }
}

// Stable proxy objects whose internal delegates are swapped on each registerLanguageServices call.
// Monaco provider registration is permanent (cannot be re-registered), so we register once using
// these proxies and update the delegates to point at the current Compiler's services whenever the
// store creates a new Compiler instance (e.g. on hot-reload or test teardown).
type MonacoServices = Awaited<ReturnType<Compiler['initMonacoServices']>>;
let currentServices: MonacoServices | null = null;
let areServicesRegistered = false;

export async function registerLanguageServices (compiler: Compiler): Promise<void> {
  // Always update current services so the proxies below delegate to the latest Compiler.
  currentServices = await compiler.initMonacoServices();

  if (areServicesRegistered) return;
  areServicesRegistered = true;

  // Register stable proxy providers that forward to whatever `currentServices` points at.
  // This ensures that if the Compiler is recreated, language features still work correctly.
  monaco.languages.registerDefinitionProvider(DBML_LANGUAGE_ID, {
    provideDefinition: (...args) => currentServices?.definitionProvider.provideDefinition(...args) ?? null,
  });
  monaco.languages.registerReferenceProvider(DBML_LANGUAGE_ID, {
    provideReferences: (...args) => currentServices?.referenceProvider.provideReferences(...args) ?? [],
  });
  monaco.languages.registerCompletionItemProvider(DBML_LANGUAGE_ID, {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: (...args) => currentServices?.autocompletionProvider.provideCompletionItems(...args) ?? { suggestions: [] },
  });
}

export function updateDiagnostics (model: monaco.editor.ITextModel): void {
  if (!currentServices) return;
  const markers = (currentServices.diagnosticsProvider as { provideMarkers(): monaco.editor.IMarkerData[] }).provideMarkers();
  monaco.editor.setModelMarkers(model, 'dbml', markers);
}
