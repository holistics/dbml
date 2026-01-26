import type Compiler from '@/compiler';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { MarkerSeverity, MarkerData } from '@/services/types';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';

export interface Diagnostic {
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
    const nodeOrToken = errorOrWarning.nodeOrToken;

    // Get position from the node or token
    // Both SyntaxNode and SyntaxToken always have startPos and endPos
    let startPos, endPos;
    if (Array.isArray(nodeOrToken)) {
      // Handle array of nodes/tokens - use first and last
      const firstItem = nodeOrToken[0] as SyntaxNode | SyntaxToken;
      const lastItem = nodeOrToken[nodeOrToken.length - 1] as SyntaxNode | SyntaxToken;
      startPos = firstItem.startPos;
      endPos = lastItem.endPos;
    } else {
      // Single node or token
      const item = nodeOrToken as SyntaxNode | SyntaxToken;
      startPos = item.startPos;
      endPos = item.endPos;
    }

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
    // Error = 8, Warning = 4, Info = 2, Hint = 1
    return severity === 'error' ? 8 : 4;
  }
}
