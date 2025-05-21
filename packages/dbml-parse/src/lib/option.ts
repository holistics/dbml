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
  unwrap_or<S> (orValue: S): S | T {
    return this.value;
  }

  and_then<S> (callback: (_: T) => Option<S>): Option<S> {
    return callback(this.value);
  }

  map<S> (callback: (_: T) => S): Option<S> {
    return new Some(callback(this.value));
  }

  isOk (): boolean {
    return true;
  }
}

export class None<T> {
  // add `value` for direct access (same api with `Some`)
  value = undefined;

  unwrap (): T {
    throw new Error('Trying to unwrap a None value');
  }

  unwrap_or<S> (orValue: S): S | T {
    return orValue;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  and_then<S> (callback: (_: T) => Option<S>): Option<S> {
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
}
