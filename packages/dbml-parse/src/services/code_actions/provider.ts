import type Compiler from '@/compiler';
import type { CompileInfo, QuickFix } from '@/core/types/errors';
import { CompileErrorCode } from '@/core/types/errors';
import type {
  CodeActionProvider, CodeActionList, CodeAction, CodeActionContext,
  TextModel, Range, CancellationToken, WorkspaceEdit, MarkerData,
} from '../types';

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

    const infos = this.compiler.interpretProject().getInfos();
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

  private findInfosForMarker (infos: CompileInfo[], marker: MarkerData): CompileInfo[] {
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
    return {
      title: fix.title,
      edit,
      diagnostics: [
        marker,
      ],
    };
  }
}
