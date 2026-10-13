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

/**
 * @param suppress clear the markers instead of asking for them.
 *
 * DBML's validator has nothing useful to say about an architecture document: it is the same
 * grammar, so the file parses, and a different vocabulary, so every element in it comes back as
 * an unknown kind. This goes straight to the compiler rather than through the parser store, so
 * suppressing it there was not enough; the squiggles came back from here.
 */
export function updateDiagnosticMarkers (model: monaco.editor.ITextModel, suppress = false): void {
  if (!services) return;
  const filepath = model.uri ? Filepath.fromUri(String(model.uri)) : undefined;
  if (!filepath) return;
  const markers = suppress ? [] : services.diagnosticsProvider.provideMarkers(filepath);
  monaco.editor.setModelMarkers(model, languageId, markers);
}
