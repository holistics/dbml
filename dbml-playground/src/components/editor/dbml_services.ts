import * as monaco from 'monaco-editor';
import { Compiler, Filepath, type MemoryProjectLayout } from '@dbml/parse';
import { DBMLLanguageService } from './dbml_language';

type MonacoServices = Awaited<ReturnType<Compiler['initMonacoServices']>>;

let services: MonacoServices | undefined;
let registered = false;

const languageId = DBMLLanguageService.getLanguageId();

function syncModelToCompiler (compiler: Compiler, model: monaco.editor.ITextModel): void {
  if (!model.uri) return;
  (compiler.layout as MemoryProjectLayout).setSource(Filepath.fromUri(String(model.uri)), model.getValue());
}

export async function setupDbmlServices (compiler: Compiler): Promise<void> {
  services = compiler.initMonacoServices();
  if (registered) return;
  registered = true;

  monaco.languages.registerDefinitionProvider(languageId, {
    provideDefinition: (model, position) => {
      syncModelToCompiler(compiler, model);
      return services?.definitionProvider.provideDefinition(model as any, position);
    },
  });
  monaco.languages.registerReferenceProvider(languageId, {
    provideReferences: (model, position) => {
      syncModelToCompiler(compiler, model);
      return services?.referenceProvider.provideReferences(model as any, position);
    },
  });
  monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: services.autocompletionProvider.triggerCharacters,
    provideCompletionItems: (model, position) => {
      syncModelToCompiler(compiler, model);
      return services?.autocompletionProvider.provideCompletionItems(model as any, position);
    },
  });
}

export function updateDiagnosticMarkers (model: monaco.editor.ITextModel): void {
  if (!services) return;
  const filepath = model.uri ? Filepath.fromUri(String(model.uri)) : undefined;
  if (filepath) {
    const markers = services.diagnosticsProvider.provideMarkers(filepath);
    monaco.editor.setModelMarkers(model, languageId, markers);
  }
}
