import { CompileError, CompileWarning } from './errors';

// Used to hold the result of a computation and any errors/warnings along the way
export default class Report<T> {
  private value: T;

  private errors: CompileError[];

  private warnings?: CompileWarning[];

  constructor (value: T, errors?: CompileError[], warnings?: CompileWarning[]) {
    this.value = value;
    this.errors = errors === undefined ? [] : errors;
    if (warnings?.length) {
      this.warnings = warnings;
    }
  }

  getValue (): T {
    return this.value;
  }

  getErrors (): CompileError[] {
    return this.errors;
  }

  getWarnings (): CompileWarning[] {
    return this.warnings || [];
  }

  chain<U>(fn: (_: T) => Report<U>): Report<U> {
    const res = fn(this.value);
    const errors = [...this.errors, ...res.errors];
    const warnings = [...this.getWarnings(), ...res.getWarnings()];

    return new Report<U>(res.value, errors, warnings);
  }

  map<U>(fn: (_: T) => U): Report<U> {
    return new Report<U>(fn(this.value), this.errors, this.warnings);
  }
}
