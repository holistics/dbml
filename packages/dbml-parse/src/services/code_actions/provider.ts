import type Compiler from '@/compiler';
import type { QuickFix } from '@/core/types/errors';
import type {
  CodeActionProvider, CodeActionList, CodeAction, CodeActionContext,
  TextModel, Range, CancellationToken, WorkspaceEdit, MarkerData,
} from '../types';
import { Uri } from '../types';
import { Filepath } from '@/core/types/filepath';
import { getEditorRange } from '../utils';

// Provides quick fixes for diagnostics that have attached QuickFix data.
// Monaco calls this when the user hovers over or clicks on a marker.
export default class DBMLCodeActionProvider implements CodeActionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideCodeActions (
    model: TextModel,
    _range: Range,
    context: CodeActionContext,
    _token: CancellationToken,
  ): CodeActionList | undefined {
    // Only proceed if Monaco passed markers at the cursor position.
    if (!context.markers.length) return undefined;

    // Collect all hints that have quick fixes attached.
    const hints = this.compiler.interpretProject().getHints()
      .filter((h) => h.quickFixes?.length);
    if (!hints.length) return undefined;

    // Match each marker to its corresponding hint by exact position,
    // then collect the quick fixes.
    const actions: CodeAction[] = [];

    for (const marker of context.markers) {
      for (const hint of hints) {
        const range = getEditorRange(model, hint.nodeOrToken);
        if (range.startLineNumber !== marker.startLineNumber
          || range.startColumn !== marker.startColumn
          || range.endLineNumber !== marker.endLineNumber
          || range.endColumn !== marker.endColumn) continue;

        for (const fix of hint.quickFixes ?? []) {
          actions.push(this.quickFixToCodeAction(fix, model, marker));
        }
      }
    }

    if (!actions.length) return undefined;
    return { actions, dispose () {} };
  }

  // Convert a QuickFix (offset-based) to a Monaco CodeAction (line/column-based).
  private quickFixToCodeAction (fix: QuickFix, model: TextModel, marker: MarkerData): CodeAction {
    const uri = model.uri;
    const modelFilepath = Filepath.fromUri(String(uri));
    const resource = fix.filepath.equals(modelFilepath)
      ? uri
      : Uri.parse(fix.filepath.toUri({ protocol: uri.scheme }));
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

    // Link the action to the marker so Monaco shows it as a quick fix.
    return {
      title: fix.title,
      edit,
      diagnostics: [
        marker,
      ],
    };
  }
}
