export type Option<T> = Some<T> | None<T>;

export class Some<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  unwrap(): T {
    return this.value;
  }

  unwrap_or<S>(orValue: S): S | T {
    return this.value;
  }

  and_then<S>(callback: (_: T) => Option<S>): Option<S> {
    return callback(this.value);
  }

  map<S>(callback: (_: T) => S): Option<S> {
    return new Some(callback(this.value));
  }

  isOk(): boolean {
    return true;
  }
}

export class None<T> {
  unwrap(): T {
    throw new Error('Trying to unwrap a None value');
  }

  unwrap_or<S>(orValue: S): S | T {
    return orValue;
  }

  and_then<S>(callback: (_: T) => Option<S>): Option<S> {
    return new None();
  }

  map<S>(callback: (_: T) => S): Option<S> {
    return new None();
  }

  isOk(): boolean {
    return false;
  }
}
