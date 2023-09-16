// This module contains types that utilize the Typescript's typechecking system
// to typecheck some non-trivial constraints

export type IsTrue<T extends true> = null;
export type IsFalse<T extends false> = null;
export function _metacheck<T>() {}

// Check that T extends U
export type DoesExtend<T, U> = T extends U ? true : false;

// Convert an enum type E to an interface of type { [enum_member]: [enum_value] as number }
type KeyValueFromEnum<T> = {
  [K in keyof T]: `${Extract<T[K], number>}` extends `${infer U extends number}` ? U : never;
};

// Check that two enum types are identical
// Remember to pass `typeof EnumObj` not `EnumObj` as type parameters
export type AreEnumsIdentical<T, U> = DoesExtend<KeyValueFromEnum<T>, KeyValueFromEnum<U>> &
  DoesExtend<KeyValueFromEnum<U>, KeyValueFromEnum<T>>;
