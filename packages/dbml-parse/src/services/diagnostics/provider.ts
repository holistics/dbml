import type Compiler from '@/compiler';
import type { Filepath } from '@/compiler/projectLayout/filepath';
import type { CompileError, CompileWarning } from '@/core/errors';
import { MarkerSeverity, MarkerData } from '@/services/types';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';

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
  provideDiagnostics (filepath?: Filepath): Diagnostic[] {
    return [...this.provideErrors(filepath), ...this.provideWarnings(filepath)];
  }

  provideErrors (filepath?: Filepath): Diagnostic[] {
    const errors = filepath ? this.compiler.fileErrors(filepath) : this.compiler.projectErrors();
    return errors.map((error: CompileError) => this.createDiagnostic(error, 'error'));
  }

  provideWarnings (filepath?: Filepath): Diagnostic[] {
    const warnings = filepath ? this.compiler.fileWarnings(filepath) : this.compiler.projectWarnings();
    return warnings.map((warning: CompileWarning) => this.createDiagnostic(warning, 'warning'));
  }

  /**
   * Convert Monaco markers format (for editor integration)
   */
  provideMarkers (filepath?: Filepath): MarkerData[] {
    const diagnostics = this.provideDiagnostics(filepath);
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
    };
  }

  private getSeverityValue (severity: 'error' | 'warning'): MarkerSeverity {
    // Monaco marker severity values
    return severity === 'error' ? MarkerSeverity.Error : MarkerSeverity.Warning;
  }
}
