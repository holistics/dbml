import { uniqBy } from 'lodash-es';
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

    // Collect infos for the current file that have quick fixes attached.
    const filepath = Filepath.fromUri(String(model.uri));
    const infos = this.compiler.interpretProject().getInfos()
      .filter((h) => h.quickFixes?.length && h.filepath.equals(filepath));
    if (!infos.length) return undefined;

    // Match each marker to its corresponding hint by exact position,
    // then collect the quick fixes.
    const actions: CodeAction[] = [];

    for (const marker of context.markers) {
      for (const hint of infos) {
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

    // Deduplicate by title + marker position.
    const unique = uniqBy(actions, (a) => {
      const d = a.diagnostics?.[0] as MarkerData | undefined;
      return `${a.title}@${d?.startLineNumber}:${d?.startColumn}`;
    });
    if (!unique.length) return undefined;
    return { actions: unique, dispose () {} };
  }

  // Convert a QuickFix (offset-based) to a Monaco CodeAction (line/column-based).
  private quickFixToCodeAction (fix: QuickFix, model: TextModel, marker: MarkerData): CodeAction {
    const resource = Uri.parse(fix.filepath.toUri({ protocol: model.uri.scheme }));
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
      kind: 'quickfix', // required for Monaco to show it in the diagnostic hover dropdown
      edit,
      diagnostics: [
        marker,
      ],
    };
  }
}
