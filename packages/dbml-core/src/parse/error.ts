export type WarningLevel = 'error' | 'warning' | 'info';

export type ErrorCode = number;

export interface EditorPosition {
  line: number;
  column: number;
}

export interface CompilerDiagnostic {
  readonly message: string;
  readonly filepath?: string;
  readonly stack?: unknown;
  readonly location: {
    start: EditorPosition;
    end?: EditorPosition;
  };
  readonly type?: WarningLevel;
  readonly code?: ErrorCode;
}

type DiagInput = CompilerDiagnostic | CompilerError | DiagInput[];

export class CompilerError {
  diags: CompilerDiagnostic[];

  constructor (diags: CompilerDiagnostic[]) {
    this.diags = diags;
  }

  static create (nestedDiags: DiagInput): CompilerError {
    return new CompilerError(flattenDiag(nestedDiags));
  }

  map (callback: (diag: CompilerDiagnostic) => CompilerDiagnostic): CompilerError {
    return CompilerError.create(this.diags.map(callback));
  }
}

function flattenDiag (diag: DiagInput): CompilerDiagnostic[] {
  if (Array.isArray(diag)) return diag.flatMap(flattenDiag);
  if (diag instanceof CompilerError) return diag.diags;
  return [diag];
}
