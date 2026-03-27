// An entity that can be interned — i.e. reduced to a stable, opaque identity
// suitable for use as a map key or cache key.
// Id must be a primitive type so it can serve as a reliable Map key.
export interface Internable<Id extends Primitive> {
  intern (): Id;
}

export type Primitive = string | number | boolean | symbol | bigint | null | undefined;

export function intern<T extends Primitive, Id extends Primitive> (value: Internable<Id> | T | T[]): Id | T | string;
export function intern<Id extends Primitive> (value: Internable<Id>): Id;
export function intern<T extends Primitive> (value: T): T;
export function intern<T extends Primitive> (value: T[]): string;
export function intern (value: Primitive | Primitive[] | Internable<Primitive>): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(String).join('\0');
  if (typeof value === 'object' && 'intern' in value) return value.intern();
  return value;
}

// A Map keyed by Internable objects. Automatically interns keys on every
// access so callers never need to call .intern() themselves.
export class InternedMap<K extends Internable<P>, V, P extends Primitive = ReturnType<K['intern']>> {
  private readonly map: Map<P, V>;

  constructor () {
    this.map = new Map();
  }

  get (key: K): V | undefined {
    return this.map.get(key.intern() as P);
  }

  set (key: K, value: V): this {
    this.map.set(key.intern() as P, value);
    return this;
  }

  has (key: K): boolean {
    return this.map.has(key.intern() as P);
  }

  delete (key: K): boolean {
    return this.map.delete(key.intern() as P);
  }

  get size (): number {
    return this.map.size;
  }
}
