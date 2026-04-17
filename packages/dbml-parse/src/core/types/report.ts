import {
  CompileError, CompileWarning,
} from './errors';

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

  filter<S extends symbol> (filteredValue: S): Report<undefined | Exclude<T, S>> {
    if (this.value as any === filteredValue) return new Report(undefined, this.errors, this.warnings);
    return this as Report<Exclude<T, S>>;
  }

  hasValue<S> (value: S): this is Report<S> {
    return this.value as any === value;
  }

  getFiltered<S extends symbol | undefined | null> (...filteredValues: S[]): Exclude<T, S> | undefined {
    return filteredValues.includes(this.value as any) ? undefined : this.value as Exclude<T, S>;
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

  chainFiltered<S extends symbol | undefined | null, U>(fn: (_: Exclude<T, S>) => Report<U>, ...filteredValues: S[]): Report<U | undefined> {
    if (filteredValues.includes(this.value as any)) return new Report(undefined, this.errors, this.warnings);
    const res = fn(this.value as Exclude<T, S>);
    const errors = [
      ...this.errors,
      ...res.errors,
    ];
    const warnings = [
      ...this.getWarnings(),
      ...res.getWarnings(),
    ];

    return new Report<U>(res.value, errors, warnings);
  }

  chain<U>(fn: (_: T) => Report<U>): Report<U> {
    const res = fn(this.value);
    const errors = [
      ...this.errors,
      ...res.errors,
    ];
    const warnings = [
      ...this.getWarnings(),
      ...res.getWarnings(),
    ];

    return new Report<U>(res.value, errors, warnings);
  }

  mapFiltered<S extends symbol | undefined | null, U>(fn: (_: Exclude<T, S>) => U, ...filteredValues: S[]): Report<U | undefined> {
    if (filteredValues.includes(this.value as any)) return new Report(undefined, this.errors, this.warnings);
    return new Report<U>(fn(this.value as Exclude<T, S>), this.errors, this.warnings);
  }

  map<U>(fn: (_: T) => U): Report<U> {
    return new Report<U>(fn(this.value), this.errors, this.warnings);
  }
}
