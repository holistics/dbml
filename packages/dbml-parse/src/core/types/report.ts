import { CompileError, CompileWarning } from './errors';

// Used to hold the result of a computation and any errors/warnings along the way
export default class Report<T> {
  private value: T;

  private errors: CompileError[];

  private warnings?: CompileWarning[];

  static create<T> (value: T, errors?: CompileError[], warnings?: CompileWarning[]) {
    return new Report(value, errors, warnings);
  }

  constructor (value: T, errors?: CompileError[], warnings?: CompileWarning[]) {
    this.value = value;
    this.errors = errors === undefined ? [] : errors;
    if (warnings?.length) {
      this.warnings = warnings;
    }
  }

  hasValue<S> (value: S): this is Report<S> {
    return this.value as any === value;
  }

  getFiltered<S> (filteredValue: S): Exclude<T, typeof filteredValue> | undefined {
    return this.value as any === filteredValue ? undefined : this.value as Exclude<T, typeof filteredValue>;
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
