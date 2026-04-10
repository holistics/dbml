import type Compiler from '@/compiler';
import type { CompileError, CompileWarning } from '@/core/types/errors';
import { MarkerSeverity, MarkerData } from '@/services/types';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';

// This is the same format that dbdiagram-frontend uses
interface Diagnostic {
  type: 'error' | 'warning';
  text: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  code?: string | number;
}

export default class DBMLDiagnosticsProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  /**
   * Get all diagnostics (errors and warnings) from the current compilation
   */
  provideDiagnostics (): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const report = this.compiler.parse._();

    // Add errors
    const errors = report.getErrors();
    for (const error of errors) {
      diagnostics.push(this.createDiagnostic(error, 'error'));
    }

    // Add warnings
    const warnings = report.getWarnings();
    for (const warning of warnings) {
      diagnostics.push(this.createDiagnostic(warning, 'warning'));
    }

    return diagnostics;
  }

  /**
   * Get only errors from the current compilation
   */
  provideErrors (): Diagnostic[] {
    const errors = this.compiler.parse._().getErrors();
    return errors.map((error) => this.createDiagnostic(error, 'error'));
  }

  /**
   * Get only warnings from the current compilation
   */
  provideWarnings (): Diagnostic[] {
    const warnings = this.compiler.parse._().getWarnings();
    return warnings.map((warning) => this.createDiagnostic(warning, 'warning'));
  }

  /**
   * Convert Monaco markers format (for editor integration)
   */
  provideMarkers (): MarkerData[] {
    const diagnostics = this.provideDiagnostics();
    return diagnostics.map((diag) => {
      const severity = this.getSeverityValue(diag.type);
      return {
        severity,
        message: diag.text,
        startLineNumber: diag.startRow,
        startColumn: diag.startColumn,
        endLineNumber: diag.endRow,
        endColumn: diag.endColumn,
        code: diag.code ? String(diag.code) : undefined,
      };
    });
  }

  private createDiagnostic (
    errorOrWarning: CompileError | CompileWarning,
    severity: 'error' | 'warning',
  ): Diagnostic {
    const n = errorOrWarning.nodeOrToken as any;

    // SyntaxNode / SyntaxToken: has 0-based startPos / endPos directly
    if (n?.startPos) {
      return {
        type: severity,
        text: errorOrWarning.diagnostic,
        startRow: n.startPos.line + 1,
        startColumn: n.startPos.column + 1,
        endRow: n.endPos.line + 1,
        endColumn: n.endPos.column + 1,
        code: errorOrWarning.code,
      };
    }

    // Schema objects (e.g. TableRecord): position is in .token: TokenPosition
    // whose .start/.end are already 1-based (set by getTokenPosition).
    if (n?.token?.start) {
      return {
        type: severity,
        text: errorOrWarning.diagnostic,
        startRow: n.token.start.line,
        startColumn: n.token.start.column,
        endRow: n.token.end?.line ?? n.token.start.line,
        endColumn: n.token.end?.column ?? n.token.start.column,
        code: errorOrWarning.code,
      };
    }

    return {
      type: severity,
      text: errorOrWarning.diagnostic,
      startRow: 1,
      startColumn: 1,
      endRow: 1,
      endColumn: 1,
      code: errorOrWarning.code,
    };
  }

  private getSeverityValue (severity: 'error' | 'warning'): MarkerSeverity {
    // Monaco marker severity values
    return severity === 'error' ? MarkerSeverity.Error : MarkerSeverity.Warning;
  }
}
