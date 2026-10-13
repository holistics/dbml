export declare type WarningLevel =
  | 'error'
  | 'warning'
  | 'info';

export declare type ErrorCode = number;

export declare interface EditorPosition {
  line: number;
  column: number;
}

export declare interface CompilerDiagnostic {
  readonly message: Readonly<string>;
  readonly filepath?: Readonly<string>;
  readonly stack?: Readonly<unknown>;
  readonly location: {
      start: Readonly<EditorPosition>,
      end?: Readonly<EditorPosition>,
  };
  readonly type?: Readonly<WarningLevel>;
  readonly code?: Readonly<ErrorCode>;
}

export declare class CompilerDiagnostics {
  diags: CompilerDiagnostic[];
  constructor(diags: CompilerDiagnostic[]);
  static create(nestedDiags: unknown): CompilerDiagnostics;
  map(callback: (diag: CompilerDiagnostic) => CompilerDiagnostic): CompilerDiagnostics;
}