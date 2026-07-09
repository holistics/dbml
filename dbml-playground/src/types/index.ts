export interface ParserError {
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
}
