export type Option<T> = Some<T> | None<T>;

export class Some<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  unwrap(): T {
    return this.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  unwrap_or<S>(orValue: S): S | T {
    return this.value;
  }

  and_then<S>(callback: (_: T) => Option<S>): Option<S> {
    return callback(this.value);
  }

  map<S>(callback: (_: T) => S): Option<S> {
    return new Some(callback(this.value));
  }

  // eslint-disable-next-line class-methods-use-this
  isOk(): boolean {
    return true;
  }
}

export class None<T> {
  // eslint-disable-next-line class-methods-use-this
  unwrap(): T {
    throw new Error('Trying to unwrap a None value');
  }

  // eslint-disable-next-line class-methods-use-this
  unwrap_or<S>(orValue: S): S | T {
    return orValue;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  and_then<S>(callback: (_: T) => Option<S>): Option<S> {
    return new None();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  map<S>(callback: (_: T) => S): Option<S> {
    return new None();
  }

  // eslint-disable-next-line class-methods-use-this
  isOk(): boolean {
    return false;
  }
}
