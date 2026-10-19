import * as monaco from 'monaco-editor';
import { Compiler, Filepath } from '@dbml/parse';
import { DBMLLanguageService } from './dbml_language';

type MonacoServices = Awaited<ReturnType<Compiler['initMonacoServices']>>;

let services: MonacoServices | undefined;
let registered = false;

const languageId = DBMLLanguageService.getLanguageId();

export async function setupDbmlServices (compiler: Compiler): Promise<void> {
  services = compiler.initMonacoServices();
  if (registered) return;
  registered = true;

  monaco.languages.registerDefinitionProvider(languageId, services.definitionProvider as any);
  monaco.languages.registerReferenceProvider(languageId, services.referenceProvider as any);
  monaco.languages.registerCompletionItemProvider(languageId, services.autocompletionProvider as any);
  monaco.languages.registerCodeActionProvider(languageId, services.codeActionProvider as any);
}

export function updateDiagnosticMarkers (model: monaco.editor.ITextModel): void {
  if (!services) return;
  const filepath = model.uri ? Filepath.fromUri(String(model.uri)) : undefined;
  if (filepath) {
    const markers = services.diagnosticsProvider.provideMarkers(filepath);
    monaco.editor.setModelMarkers(model, languageId, markers);
  }
}
