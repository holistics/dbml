import * as monaco from 'monaco-editor';
import {
  Compiler, Filepath,
} from '@dbml/parse';
import {
  DBMLLanguageService,
} from './dbml-language';
import logger from '@/utils/logger';

type MonacoServices = Awaited<ReturnType<Compiler['initMonacoServices']>>;

let currentServices: MonacoServices | undefined;
let registered = false;

const languageId = DBMLLanguageService.getLanguageId();

function syncModelToCompiler (compiler: Compiler, model: monaco.editor.ITextModel): void {
  if (!model.uri) return;
  compiler.setSource(Filepath.fromUri(String(model.uri)), model.getValue());
}

export async function setupDbmlServices (compiler: Compiler): Promise<void> {
  try {
    currentServices = await compiler.initMonacoServices();
    if (registered) return;
    registered = true;

    monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: (model, position, token) => {
        syncModelToCompiler(compiler, model);
        return (currentServices!.definitionProvider as any).provideDefinition(model, position, token);
      },
    });
    monaco.languages.registerReferenceProvider(languageId, {
      provideReferences: (model, position, context, token) => {
        syncModelToCompiler(compiler, model);
        return (currentServices!.referenceProvider as any).provideReferences(model, position, context, token);
      },
    });
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: (currentServices.autocompletionProvider as any).triggerCharacters,
      provideCompletionItems: (model, position, context, token) => {
        syncModelToCompiler(compiler, model);
        return (currentServices!.autocompletionProvider as any).provideCompletionItems(model, position, context, token);
      },
    });
  } catch (_err) {
    logger.warn('Failed to register Monaco language services');
  }
}

export function updateDiagnosticMarkers (model: monaco.editor.ITextModel): void {
  if (!currentServices) return;
  const filepath = model.uri ? Filepath.fromUri(String(model.uri)) : undefined;
  const markers = (currentServices.diagnosticsProvider as {
    provideMarkers(f?: Filepath): monaco.editor.IMarkerData[];
  }).provideMarkers(filepath);
  monaco.editor.setModelMarkers(model, languageId, markers);
}
