export default class Result<T, E> {
  private value?: T;

  private errors: E[];

  constructor(value?: T, errors?: E[]) {
    this.value = value;
    this.errors = errors === undefined ? [] : errors;
  }

  unwrap(): T {
    if (this.value === undefined) {
      throw this.errors;
    }

    return this.value;
  }

  diag(): E[] {
    return this.errors;
  }

  chain<U>(fn: (_: T) => Result<U, E>): Result<U, E> {
    if (this.value === undefined) {
      return new Result<U, E>(undefined, this.errors);
    }
    const res = fn(this.value);
    const errors = [...this.errors, ...res.errors];

    return new Result<U, E>(res.value, errors);
  }
}
