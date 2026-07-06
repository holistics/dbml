import type Compiler from '@/compiler';
import type { CompileHint, QuickFix } from '@/core/types/errors';
import type {
  CodeActionProvider, CodeActionList, CodeAction, CodeActionContext,
  TextModel, Range, CancellationToken, WorkspaceEdit, MarkerData,
} from '../types';
import { Uri } from '../types';

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
    const markers = context.markers;
    if (!markers.length) return undefined;

    const infos = this.compiler.interpretProject().getHints();
    const actions: CodeAction[] = [];

    for (const marker of markers) {
      const matchingInfos = this.findInfosForMarker(infos, marker);
      for (const info of matchingInfos) {
        for (const fix of info.quickFixes ?? []) {
          actions.push(this.quickFixToCodeAction(fix, model, marker));
        }
      }
    }

    if (!actions.length) return undefined;
    return { actions, dispose () {} };
  }

  private findInfosForMarker (infos: CompileHint[], marker: MarkerData): CompileHint[] {
    return infos.filter((info) => {
      const node = info.nodeOrToken;
      return info.quickFixes?.length
        && node.startPos.line + 1 === marker.startLineNumber
        && node.startPos.column + 1 === marker.startColumn
        && node.endPos.line + 1 === marker.endLineNumber
        && node.endPos.column + 1 === marker.endColumn;
    });
  }

  private quickFixToCodeAction (fix: QuickFix, model: TextModel, marker: MarkerData): CodeAction {
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
    return {
      title: fix.title,
      edit,
      diagnostics: [
        marker,
      ],
    };
  }
}
