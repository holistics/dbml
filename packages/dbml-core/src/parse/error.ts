export type WarningLevel = 'error' | 'warning' | 'info';

export type ErrorCode = number;

export interface EditorPosition {
  line: number;
  column: number;
}

export interface CompilerDiagnostic {
  readonly message: string;
  readonly filepath: string;
  readonly stack?: unknown;
  readonly location: {
    start: EditorPosition;
    end?: EditorPosition;
  };
  readonly type?: WarningLevel;
  readonly code?: ErrorCode;
}

type DiagInput = CompilerDiagnostic | CompilerDiagnostics | DiagInput[];

export class CompilerDiagnostics {
  diags: CompilerDiagnostic[];

  constructor (diags: CompilerDiagnostic[]) {
    this.diags = diags;
  }

  static create (nestedDiags: DiagInput): CompilerDiagnostics {
    return new CompilerDiagnostics(flattenDiag(nestedDiags));
  }

  map (callback: (diag: CompilerDiagnostic) => CompilerDiagnostic): CompilerDiagnostics {
    return CompilerDiagnostics.create(this.diags.map(callback));
  }
}

function flattenDiag (diag: DiagInput): CompilerDiagnostic[] {
  if (Array.isArray(diag)) return diag.flatMap(flattenDiag);
  if (diag instanceof CompilerDiagnostics) return diag.diags;
  return [diag];
}

export interface ParseDiagnostic {
  type: 'error' | 'warning' | 'info';
  text: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  code?: number;
  filepath?: string;
}

export function processDbmlParserDiagnostics (error: CompilerDiagnostics): ParseDiagnostic[] {
  return error.diags.map((diag) => ({
    type: diag.type ?? 'error',
    text: diag.message,
    startRow: diag.location.start.line,
    startColumn: diag.location.start.column,
    endRow: diag.location.end?.line ?? diag.location.start.line,
    endColumn: diag.location.end?.column ?? diag.location.start.column,
    code: diag.code,
    filepath: diag.filepath,
  }));
}
