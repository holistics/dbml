/* eslint-disable class-methods-use-this */
// Similar to Rust Option: https://doc.rust-lang.org/std/option/enum.Option.html

export type Option<T> = Some<T> | None<T>;

export class Some<T> {
  value: T;

  constructor (value: T) {
    this.value = value;
  }

  unwrap (): T {
    return this.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  unwrapOr<S> (orValue: S): S | T {
    return this.value;
  }

  andThen<S> (callback: (_: T) => Option<S>): Option<S> {
    return callback(this.value);
  }

  map<S> (callback: (_: T) => S): Option<S> {
    return new Some(callback(this.value));
  }

  isOk (): boolean {
    return true;
  }

  orElse (callback: () => Option<T>): Option<T> {
    return this;
  }
}

export class None<T> {
  // add `value` for direct access (same api with `Some`)
  value = undefined;

  unwrap (): T {
    throw new Error('Trying to unwrap a None value');
  }

  unwrapOr<S> (orValue: S): S | T {
    return orValue;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  andThen<S> (callback: (_: T) => Option<S>): Option<S> {
    return new None();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  map<S> (callback: (_: T) => S): Option<S> {
    return new None();
  }

  // eslint-disable-next-line class-methods-use-this
  isOk (): boolean {
    return false;
  }

  orElse (callback: () => Option<T>): Option<T> {
    return callback();
  }
}
