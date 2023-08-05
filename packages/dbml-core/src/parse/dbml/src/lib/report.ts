// Used to hold the result of a computation and any errors along the way
export default class Report<T, E> {
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

  reportErrors(): E[] {
    return this.errors;
  }

  chain<U>(fn: (_: T) => Report<U, E>): Report<U, E> {
    if (this.value === undefined) {
      return new Report<U, E>(undefined, this.errors);
    }
    const res = fn(this.value);
    const errors = [...this.errors, ...res.errors];

    return new Report<U, E>(res.value, errors);
  }
}
