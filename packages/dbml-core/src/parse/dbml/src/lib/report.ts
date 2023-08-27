// Used to hold the result of a computation and any errors along the way
export default class Report<T, E> {
  private value: T;

  private errors: E[];

  constructor(value: T, errors?: E[]) {
    this.value = value;
    this.errors = errors === undefined ? [] : errors;
  }

  getValue(): T {
    return this.value;
  }

  getErrors(): E[] {
    return this.errors;
  }

  chain<U>(fn: (_: T) => Report<U, E>): Report<U, E> {
    const res = fn(this.value);
    const errors = [...this.errors, ...res.errors];

    return new Report<U, E>(res.value, errors);
  }
}
