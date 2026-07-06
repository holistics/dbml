import { CompileError, CompileWarning, CompileInfo } from './errors';

// Used to hold the result of a computation and any errors/warnings/infos along the way
export default class Report<T> {
  private value: T;

  private errors: CompileError[];

  private warnings?: CompileWarning[];

  private hints?: CompileInfo[];

  static create<T> (
    value: T,
    errors?: CompileError[],
    warnings?: CompileWarning[],
    hints?: CompileInfo[],
  ) {
    return new Report(value, errors, warnings, hints);
  }

  constructor (
    value: T,
    errors?: CompileError[],
    warnings?: CompileWarning[],
    hints?: CompileInfo[],
  ) {
    this.value = value;
    this.errors = errors ?? [];
    this.warnings = warnings;
    this.hints = hints;
  }

  filter<S extends symbol> (filteredValue: S): Report<undefined | Exclude<T, S>> {
    if (this.value as any === filteredValue) return new Report(undefined, this.errors, this.warnings, this.hints);
    return this as Report<Exclude<T, S>>;
  }

  hasValue<S> (value: S): this is Report<S> {
    return this.value as any === value;
  }

  // Extract the reported value
  // If the reported value is filteredValue, return undefined
  getFiltered<S extends symbol | undefined | null> (filteredValue: S): Exclude<T, S> | undefined {
    return this.value as any === filteredValue ? undefined : this.value as Exclude<T, S>;
  }

  getValue (): T {
    return this.value;
  }

  getErrors (): CompileError[] {
    return this.errors;
  }

  getWarnings (): CompileWarning[] {
    return this.warnings ?? [];
  }

  getHints (): CompileInfo[] {
    return this.hints ?? [];
  }

  // Chain the reported value
  // 1. Transform the reported value via `fn`
  // 2. If `fn` produces further warnings or errors, accumulate
  // If the reported value is filteredValue, return undefined
  chainFiltered<S extends symbol | undefined | null, U>(fn: (_: Exclude<T, S>) => Report<U>, filteredValue: S): Report<U | undefined> {
    if (this.value as any === filteredValue) return new Report(undefined, this.errors, this.warnings, this.hints);
    const res = fn(this.value as Exclude<T, S>);
    const errors = [
      ...this.errors,
      ...res.errors,
    ];
    const warnings = [
      ...this.getWarnings(),
      ...res.getWarnings(),
    ];
    const infos = [
      ...this.getHints(),
      ...res.getHints(),
    ];

    return new Report<U>(res.value, errors, warnings, infos);
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
    const infos = [
      ...this.getHints(),
      ...res.getHints(),
    ];

    return new Report<U>(res.value, errors, warnings, infos);
  }

  // Map the reported value
  // 1. Transform the reported value via `fn`
  // 2. `fn` cannot produce further warnings or errors
  // If the reported value is filteredValue, return undefined
  mapFiltered<S extends symbol | undefined | null, U>(fn: (_: Exclude<T, S>) => U, filteredValue: S): Report<U | undefined> {
    if (this.value as any === filteredValue) return new Report(undefined, this.errors, this.warnings, this.hints);
    return new Report<U>(fn(this.value as Exclude<T, S>), this.errors, this.warnings, this.hints);
  }

  map<U>(fn: (_: T) => U): Report<U> {
    return new Report<U>(fn(this.value), this.errors, this.warnings, this.hints);
  }
}
