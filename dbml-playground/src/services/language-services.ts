import logger from '@/utils/logger';
import * as monaco from 'monaco-editor';
import type { Compiler } from '@dbml/parse';
import { dbmlMonarchTokensProvider } from '@dbml/parse';

const DBML_LANGUAGE_CONFIG: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
    { open: '`', close: '`' },
  ],
  indentationRules: {
    increaseIndentPattern: /^(.*\{[^}]*|\s*[\{\[].*)$/,
    decreaseIndentPattern: /^(.*\}.*|\s*[\}\]].*)$/,
  },
};

const DBML_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
    { token: 'type', foreground: '008000', fontStyle: 'bold' },
    { token: 'string', foreground: 'a31515' },
    { token: 'string.backtick', foreground: 'a31515', fontStyle: 'italic' },
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    { token: 'number', foreground: '098658' },
    { token: 'number.hex', foreground: '3030c0' },
    { token: 'operator', foreground: '000000' },
    { token: 'delimiter', foreground: '000000' },
    { token: 'annotation', foreground: '808080' },
    { token: 'identifier', foreground: '000000' },
    { token: 'string.key.json', foreground: '0451a5' },
    { token: 'string.value.json', foreground: 'a31515' },
    { token: 'number.json', foreground: '098658' },
    { token: 'keyword.json', foreground: '0000ff' },
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
    monaco.languages.setLanguageConfiguration(DBML_LANGUAGE_ID, DBML_LANGUAGE_CONFIG);
    monaco.editor.defineTheme(DBML_THEME_NAME, DBML_THEME);
    isLanguageRegistered = true;
  } catch (error) {
    logger.warn('Failed to register DBML language:', error);
  }
}

let areServicesRegistered = false;
let diagnosticsProvider: { provideMarkers(): monaco.editor.IMarkerData[] } | null = null;

export async function registerLanguageServices (compiler: Compiler): Promise<void> {
  const services = await compiler.initMonacoServices();
  diagnosticsProvider = services.diagnosticsProvider as any;

  if (areServicesRegistered) return;
  areServicesRegistered = true;

  monaco.languages.registerDefinitionProvider(DBML_LANGUAGE_ID, services.definitionProvider);
  monaco.languages.registerReferenceProvider(DBML_LANGUAGE_ID, services.referenceProvider);
  monaco.languages.registerCompletionItemProvider(DBML_LANGUAGE_ID, {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: services.autocompletionProvider.provideCompletionItems.bind(services.autocompletionProvider),
  });
}

export function updateDiagnostics (model: monaco.editor.ITextModel): void {
  if (!diagnosticsProvider) return;
  const markers = diagnosticsProvider.provideMarkers();
  monaco.editor.setModelMarkers(model, 'dbml', markers);
}
