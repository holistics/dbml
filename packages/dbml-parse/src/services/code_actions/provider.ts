import type Compiler from '@/compiler';
import type { QuickFix } from '@/core/types/errors';
import type {
  CodeActionProvider, CodeActionList, CodeAction,
  TextModel, WorkspaceEdit,
} from '../types';

export default class DBMLCodeActionProvider implements CodeActionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideCodeActions (
    model: TextModel,
  ): CodeActionList | undefined {
    const infos = this.compiler.interpretProject().getInfos();
    const withFixes = infos.filter((info) => info.quickFixes?.length);
    if (!withFixes.length) return undefined;

    const actions: CodeAction[] = [];
    for (const info of withFixes) {
      for (const fix of info.quickFixes ?? []) {
        actions.push(this.quickFixToCodeAction(fix, model));
      }
    }

    if (!actions.length) return undefined;
    return { actions, dispose () {} };
  }

  private quickFixToCodeAction (fix: QuickFix, model: TextModel): CodeAction {
    const edit: WorkspaceEdit = {
      edits: fix.edits.map((e) => ({
        resource: model.uri,
        textEdit: {
          range: {
            startLineNumber: e.range.start.line + 1,
            startColumn: e.range.start.column + 1,
            endLineNumber: e.range.end.line + 1,
            endColumn: e.range.end.column + 1,
          },
          text: e.newText,
        },
        versionId: model.getVersionId(),
      })),
    };
    return { title: fix.title, edit };
  }
}
