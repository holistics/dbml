import { ParsingError } from './errors';

export default class Result<T> {
  private value?: T;

  private errors: ParsingError[];

  constructor(value?: T, errors?: ParsingError[]) {
    this.value = value;
    this.errors = errors === undefined ? [] : errors;
  }

  unwrap(): T {
    if (this.value === undefined) {
      throw this.errors;
    }

    return this.value;
  }

  diag(): ParsingError[] {
    return this.errors;
  }

  chain<U>(fn: (_: T) => Result<U>): Result<U> {
    if (this.value === undefined) {
      return new Result<U>(undefined, this.errors);
    }
    const res = fn(this.value);
    const errors = [...this.errors, ...res.errors];

    return new Result<U>(res.value, errors);
  }
}
