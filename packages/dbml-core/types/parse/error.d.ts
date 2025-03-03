export declare type WarningLevel =
  | 'error'
  | 'warning'
  | 'info';

export declare type ErrorCode = number;

export declare interface EditorPosition {
  line: number;
  column: number;
}

export interface CompilerDiagnostic {
  readonly message: Readonly<string>;
  readonly filepath?: Readonly<string>;
  readonly stack?: Readonly<unknown>;
  readonly location: {
      start: Readonly<EditorPosition>,
      // in monaco, if an end position is not specified
      // it consumes the word containing the start position
      end?: Readonly<EditorPosition>,
  };
  readonly type?: Readonly<WarningLevel>;
  readonly code?: Readonly<ErrorCode>; // the error code
}

export interface CompilerError {
  readonly diags: CompilerDiagnostic[];
}
