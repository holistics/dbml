// An entity that can be interned , i.e. reduced to a stable, opaque identity
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
