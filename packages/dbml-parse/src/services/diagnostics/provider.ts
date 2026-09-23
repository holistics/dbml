import type Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import type { CompileError, CompileWarning, CompileInfo } from '@/core/types/errors';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import { MarkerData, MarkerSeverity } from '@/services/types';

// This is the same format that dbdiagram-frontend uses
export interface DiagnosticQuickFix {
  title: string;
  shortTitle?: string;
  edits: { start: number; end: number; newText: string }[];
  isPreferred?: boolean;
}

export interface Diagnostic {
  type: 'error' | 'warning' | 'info';
  text: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  code?: string | number;
  category?: string;
  explanation?: string;
  filepath: Filepath;
  quickFixes?: DiagnosticQuickFix[];
}

export default class DBMLDiagnosticsProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  /**
   * Get all diagnostics (errors and warnings) from the current compilation
   */
  provideDiagnostics (filepath?: Filepath): Diagnostic[] {
    return [
      ...this.provideErrors(filepath),
      ...this.provideWarnings(filepath),
      ...this.provideInfos(filepath),
    ];
  }

  /**
   * Get only errors from the current compilation
   */
  provideErrors (filepath?: Filepath): Diagnostic[] {
    if (!filepath) {
      const errors = this.compiler.interpretProject().getErrors();
      return errors.map((error) => this.createDiagnostic(error, 'error'));
    }
    const errors = this.compiler.parse.errors(filepath);
    return errors.map((error) => this.createDiagnostic(error, 'error'));
  }

  /**
   * Get only warnings from the current compilation
   */
  provideWarnings (filepath?: Filepath): Diagnostic[] {
    if (!filepath) {
      const warnings = this.compiler.interpretProject().getWarnings();
      return warnings.map((warning) => this.createDiagnostic(warning, 'warning'));
    }
    const warnings = this.compiler.parse.warnings(filepath);
    return warnings.map((warning) => this.createDiagnostic(warning, 'warning'));
  }

  /**
   * Get only infos from the current compilation
   */
  provideInfos (filepath?: Filepath): Diagnostic[] {
    if (!filepath) {
      const infos = this.compiler.interpretProject().getInfos();
      return infos.map((hint) => this.createDiagnostic(hint, 'info'));
    }
    const infos = this.compiler.interpretFile(filepath).getInfos();
    return infos.map((hint) => this.createDiagnostic(hint, 'info'));
  }

  /**
   * Convert Monaco markers format (for editor integration)
   */
  provideMarkers (filepath: Filepath): MarkerData[] {
    const diagnostics = this.provideDiagnostics(filepath).filter((diag) => diag.filepath.equals(filepath)); // only provide markers for this file
    return diagnostics.map((diag) => {
      const severity = this.getSeverityValue(diag.type);
      const marker: MarkerData = {
        severity,
        message: diag.text,
        startLineNumber: diag.startRow,
        startColumn: diag.startColumn,
        endLineNumber: diag.endRow,
        endColumn: diag.endColumn,
        code: diag.code ? String(diag.code) : undefined,
      };
      return marker;
    });
  }

  private createDiagnostic (
    errorOrWarning: CompileError | CompileWarning | CompileInfo,
    severity: 'error' | 'warning' | 'info',
  ): Diagnostic {
    const nodeOrToken = errorOrWarning.nodeOrToken;

    // Get position from the node or token
    // Both SyntaxNode and SyntaxToken always have startPos and endPos
    const item = nodeOrToken as SyntaxNode | SyntaxToken;
    const startPos = item.startPos;
    const endPos = item.endPos;

    const details = errorOrWarning.details;
    const quickFixes = details?.quickFixes
      ?.filter((f) => f.edits.length > 0)
      .map((f) => ({
        title: f.title,
        shortTitle: f.shortTitle,
        edits: f.edits.map((e) => ({ start: e.start, end: e.end, newText: e.newText })),
        isPreferred: f.isPreferred,
      }));

    return {
      type: severity,
      text: errorOrWarning.diagnostic,
      startRow: startPos.line + 1,
      startColumn: startPos.column + 1,
      endRow: endPos.line + 1,
      endColumn: endPos.column + 1,
      code: errorOrWarning.code,
      category: details?.category,
      explanation: details?.explanation,
      filepath: errorOrWarning.filepath,
      quickFixes,
    };
  }

  private getSeverityValue (severity: 'error' | 'warning' | 'info'): MarkerSeverity {
    if (severity === 'error') return MarkerSeverity.Error;
    if (severity === 'warning') return MarkerSeverity.Warning;
    return MarkerSeverity.Info;
  }
}
