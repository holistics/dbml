import type Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import type {
  CompileError, CompileWarning, CompileHint, RelatedLocation,
} from '@/core/types/errors';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import { MarkerData, MarkerSeverity, Uri } from '@/services/types';

// This is the same format that dbdiagram-frontend uses
export interface Diagnostic {
  type: 'error' | 'warning' | 'hint';
  text: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  code?: string | number;
  filepath: Filepath;
  relatedLocations?: RelatedLocation[];
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
      ...this.provideHints(filepath),
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
   * Get only hints from the current compilation
   */
  provideHints (filepath?: Filepath): Diagnostic[] {
    if (!filepath) {
      const hints = this.compiler.interpretProject().getHints();
      return hints.map((hint) => this.createDiagnostic(hint, 'hint'));
    }
    const hints = this.compiler.interpretFile(filepath).getHints();
    return hints.map((hint) => this.createDiagnostic(hint, 'hint'));
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
      if (diag.relatedLocations?.length) {
        marker.relatedInformation = diag.relatedLocations.map((loc) => ({
          resource: Uri.parse(loc.nodeOrToken.filepath.toUri()),
          message: loc.message,
          startLineNumber: loc.nodeOrToken.startPos.line + 1,
          startColumn: loc.nodeOrToken.startPos.column + 1,
          endLineNumber: loc.nodeOrToken.endPos.line + 1,
          endColumn: loc.nodeOrToken.endPos.column + 1,
        }));
      }
      return marker;
    });
  }

  private createDiagnostic (
    errorOrWarning: CompileError | CompileWarning | CompileHint,
    severity: 'error' | 'warning' | 'hint',
  ): Diagnostic {
    const nodeOrToken = errorOrWarning.nodeOrToken;

    // Get position from the node or token
    // Both SyntaxNode and SyntaxToken always have startPos and endPos
    const item = nodeOrToken as SyntaxNode | SyntaxToken;
    const startPos = item.startPos;
    const endPos = item.endPos;

    return {
      type: severity,
      text: errorOrWarning.diagnostic,
      startRow: startPos.line + 1,
      startColumn: startPos.column + 1,
      endRow: endPos.line + 1,
      endColumn: endPos.column + 1,
      code: errorOrWarning.code,
      filepath: errorOrWarning.filepath,
      relatedLocations: errorOrWarning.relatedLocations,
    };
  }

  private getSeverityValue (severity: 'error' | 'warning' | 'hint'): MarkerSeverity {
    if (severity === 'error') return MarkerSeverity.Error;
    if (severity === 'warning') return MarkerSeverity.Warning;
    return MarkerSeverity.Hint;
  }
}
