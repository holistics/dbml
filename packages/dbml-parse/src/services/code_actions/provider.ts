import type Compiler from '@/compiler';
import type { QuickFix } from '@/core/types/errors';
import type {
  CodeActionProvider, CodeActionList, CodeAction, CodeActionContext,
  TextModel, Range, CancellationToken, WorkspaceEdit,
} from '../types';
import { Uri } from '../types';

export default class DBMLCodeActionProvider implements CodeActionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideCodeActions (
    model: TextModel,
    range: Range,
    _context: CodeActionContext,
    _token: CancellationToken,
  ): CodeActionList | undefined {
    const hints = this.compiler.interpretProject().getHints();
    const overlapping = hints.filter((hint) => {
      if (!hint.quickFixes?.length) return false;
      const startLine = hint.nodeOrToken.startPos.line + 1;
      const endLine = hint.nodeOrToken.endPos.line + 1;
      return startLine <= range.endLineNumber && endLine >= range.startLineNumber;
    });

    if (!overlapping.length) return undefined;

    const actions: CodeAction[] = [];
    const seen = new Set<string>();
    for (const hint of overlapping) {
      for (const fix of hint.quickFixes ?? []) {
        if (seen.has(fix.title)) continue;
        seen.add(fix.title);
        actions.push(this.quickFixToCodeAction(fix, model));
      }
    }

    if (!actions.length) return undefined;
    return { actions, dispose () {} };
  }

  private quickFixToCodeAction (fix: QuickFix, model: TextModel): CodeAction {
    const uri = model.uri;
    const resource = Uri.parse(fix.filepath.toUri({ protocol: uri.scheme }));
    const edit: WorkspaceEdit = {
      edits: fix.edits.map((e) => {
        const startPos = model.getPositionAt(e.start);
        const endPos = model.getPositionAt(e.end);
        return {
          resource,
          textEdit: {
            range: {
              startLineNumber: startPos.lineNumber,
              startColumn: startPos.column,
              endLineNumber: endPos.lineNumber,
              endColumn: endPos.column,
            },
            text: e.newText,
          },
          versionId: model.getVersionId(),
        };
      }),
    };
    return { title: fix.title, edit };
  }
}
