import * as monaco from 'monaco-editor';
import type { Compiler } from '@dbml/parse';
import { DBML_LANGUAGE_ID } from '@/components/editor/dbml-language';

let registered = false;
let diagnosticsProvider: { provideMarkers(): monaco.editor.IMarkerData[] } | null = null;

export async function registerLanguageServices (compiler: Compiler): Promise<void> {
  const services = await compiler.initMonacoServices();
  diagnosticsProvider = services.diagnosticsProvider as any;

  if (registered) return;
  registered = true;

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
