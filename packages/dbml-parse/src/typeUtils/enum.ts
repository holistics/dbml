// Compute the set difference of two enums (A - B)
// Return enum members from A whose string values are not in B
export type EnumDifference<A extends string, B extends string> =
  { [K in A]: K; }[Exclude<A, B>];
