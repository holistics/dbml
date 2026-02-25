export type WarningLevel =
  | 'error'
  | 'warning'
  | 'info';

export type ErrorCode = number;

export interface EditorPosition {
  line: number;
  column: number;
}

export interface CompilerDiagnostic {
  readonly message: Readonly<string>;
  readonly filepath?: Readonly<string>;
  readonly stack?: Readonly<unknown>;
  readonly location: {
    start: Readonly<EditorPosition>;
    // in monaco, if an end position is not specified
    // it consumes the word containing the start position
    end?: Readonly<EditorPosition>;
  };
  readonly type?: Readonly<WarningLevel>;
  readonly code?: Readonly<ErrorCode>;
}

export class CompilerError {
  diags: CompilerDiagnostic[];

  /**
   * @param {CompilerDiagnostic[]} diags
   */
  constructor (diags: CompilerDiagnostic[]) {
    this.diags = diags;
  }

  static create (nestedDiags: any): CompilerError {
    return new CompilerError(flattenDiag(nestedDiags));
  }

  map (callback: (diag: CompilerDiagnostic) => CompilerDiagnostic): CompilerError {
    return CompilerError.create(this.diags.map(callback));
  }
}

function flattenDiag (diag: any): CompilerDiagnostic[] {
  if (Array.isArray(diag)) return diag.flatMap(flattenDiag);
  if (diag instanceof CompilerError) return diag.diags;
  return [diag];
}
