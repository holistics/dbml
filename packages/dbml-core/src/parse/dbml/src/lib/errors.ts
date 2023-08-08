export enum CompileErrorCode {
  EXPECTED_THINGS = 1000,
  UNEXPECTED_THINGS,
  INVALID,
}

export class CompileError extends Error {
  code: Readonly<CompileErrorCode>;

  diagnostic: Readonly<string>;

  start: Readonly<number>;

  end: Readonly<number>;

  value: unknown;

  constructor(code: number, message: string, start: number, end: number, value?: unknown) {
    super(message);
    this.code = code;
    this.diagnostic = message;
    this.start = start;
    this.end = end;
    this.value = value;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, CompileError.prototype);
  }
}
