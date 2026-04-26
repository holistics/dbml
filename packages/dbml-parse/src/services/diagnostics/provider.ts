import type Compiler from '@/compiler';
import type {
  CompileError, CompileWarning,
} from '@/core/types/errors';
import {
  Filepath,
} from '@/core/types/filepath';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  MarkerData, MarkerSeverity,
} from '@/services/types';

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
    return [
      ...this.provideErrors(filepath),
      ...this.provideWarnings(filepath),
    ];
  }

  /**
   * Get only errors from the current compilation
   */
  provideErrors (filepath?: Filepath): Diagnostic[] {
    if (filepath) {
      const errors = this.compiler.interpretFile(filepath).getErrors();
      return errors.map((error) => this.createDiagnostic(error, 'error'));
    }
    return this.compiler.interpretProject().getErrors().map((error) => this.createDiagnostic(error, 'error'));
  }

  /**
   * Get only warnings from the current compilation
   */
  provideWarnings (filepath?: Filepath): Diagnostic[] {
    if (filepath) {
      const errors = this.compiler.interpretFile(filepath).getWarnings();
      return errors.map((error) => this.createDiagnostic(error, 'warning'));
    }
    return this.compiler.interpretProject().getWarnings().map((error) => this.createDiagnostic(error, 'warning'));
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
