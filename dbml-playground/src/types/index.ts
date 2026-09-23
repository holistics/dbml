export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type DiagnosticFilter = 'all' | DiagnosticSeverity;

export const SEVERITY_DOT: Record<DiagnosticSeverity, string> = {
  error: 'bg-red-500',
  warning: 'bg-yellow-400',
  info: 'bg-blue-500',
};

export interface QuickFixEdit {
  readonly start: number;
  readonly end: number;
  readonly newText: string;
}

export interface QuickFixAction {
  readonly title: string;
  readonly shortTitle?: string;
  readonly edits: readonly QuickFixEdit[];
  readonly isPreferred?: boolean;
}

export interface ParserDiagnostic {
  readonly code: number;
  readonly message: string;
  readonly location: {
    readonly line: number;
    readonly column: number;
  };
  readonly endLocation: {
    readonly line: number;
    readonly column: number;
  };
  readonly category?: string;
  readonly explanation?: string;
  readonly quickFixes?: readonly QuickFixAction[];
}
