type BaseRelationshipOp = '>' | '<' | '-' | '<>';
export type RelationshipOp = `${'?' | ''}${BaseRelationshipOp}${'?' | ''}`;

// A cardinality is either:
//   - a single number: exactly N (for backwards compatibility)
//   - '*': shorthand for 1..* (for backwards compatibility)
//   - 'min..max': a range (e.g. '0..1', '1..*', '2..5')
export type RelationCardinality = `${number}` | '*' | `${number}..${number | '*'}`;

// Parse any RelationCardinality into its numeric min/max
export function parseCardinality (c: RelationCardinality): { min: number; max: number | '*' } {
  if (c === '*') return { min: 1, max: '*' };
  const [
    min,
    max,
  ] = c.split('..');
  const minNum = Number(min);
  if (max === undefined) return { min: minNum, max: minNum };
  return {
    min: minNum,
    max: max === '*' ? '*' : Number(max),
  };
}

export const CARDINALITY_ONE: RelationCardinality = '1';
export const CARDINALITY_MAYBE: RelationCardinality = '0..1';
export const CARDINALITY_SOME: RelationCardinality = '*'; // Equivalent to '1..*'
export const CARDINALITY_MANY: RelationCardinality = '0..*';

export const RELATIONSHIP_OPS: ReadonlyMap<RelationshipOp, [RelationCardinality, RelationCardinality]> = new Map<RelationshipOp, [RelationCardinality, RelationCardinality]>([
  [
    '-',
    [
      CARDINALITY_ONE,
      CARDINALITY_ONE,
    ],
  ],
  [
    '<>',
    [
      CARDINALITY_SOME,
      CARDINALITY_SOME,
    ],
  ],
  [
    '>',
    [
      CARDINALITY_SOME,
      CARDINALITY_ONE,
    ],
  ],
  [
    '<',
    [
      CARDINALITY_ONE,
      CARDINALITY_SOME,
    ],
  ],
  [
    '-?',
    [
      CARDINALITY_ONE,
      CARDINALITY_MAYBE,
    ],
  ],
  [
    '?-',
    [
      CARDINALITY_MAYBE,
      CARDINALITY_ONE,
    ],
  ],
  [
    '?-?',
    [
      CARDINALITY_MAYBE,
      CARDINALITY_MAYBE,
    ],
  ],
  [
    '?>',
    [
      CARDINALITY_MANY,
      CARDINALITY_ONE,
    ],
  ],
  [
    '>?',
    [
      CARDINALITY_SOME,
      CARDINALITY_MAYBE,
    ],
  ],
  [
    '?>?',
    [
      CARDINALITY_MANY,
      CARDINALITY_MAYBE,
    ],
  ],
  [
    '?<',
    [
      CARDINALITY_MAYBE,
      CARDINALITY_SOME,
    ],
  ],
  [
    '<?',
    [
      CARDINALITY_ONE,
      CARDINALITY_MANY,
    ],
  ],
  [
    '?<?',
    [
      CARDINALITY_MAYBE,
      CARDINALITY_MANY,
    ],
  ],
  [
    '?<>',
    [
      CARDINALITY_MANY,
      CARDINALITY_SOME,
    ],
  ],
  [
    '<>?',
    [
      CARDINALITY_SOME,
      CARDINALITY_MANY,
    ],
  ],
  [
    '?<>?',
    [
      CARDINALITY_MANY,
      CARDINALITY_MANY,
    ],
  ],
]);

// Inverse map: `${leftCardinality}-${rightCardinality}` -> operator
const CARDINALITY_TO_OP: ReadonlyMap<string, RelationshipOp> = new Map(
  [
    ...RELATIONSHIP_OPS.entries(),
  ].map(([
    op,
    [
      left,
      right,
    ],
  ]) => [
    `${left}-${right}`,
    op,
  ]),
);

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] | undefined {
  return RELATIONSHIP_OPS.get(op as RelationshipOp);
}

export function isEndpointOneSide (relation: RelationCardinality): boolean {
  return parseCardinality(relation).max === 1;
}

export function isEndpointManySide (relation: RelationCardinality): boolean {
  return parseCardinality(relation).max === '*';
}

export function isEndpointOptional (relation: RelationCardinality): boolean {
  return parseCardinality(relation).min === 0;
}

export function isEndpointRequired (relation: RelationCardinality): boolean {
  const minCard = parseCardinality(relation).min;
  return minCard >= 1;
}

export function makeRelationshipRequired (op: RelationshipOp): BaseRelationshipOp {
  return op.replace(/\?/g, '') as BaseRelationshipOp;
}

// Reverse of getMultiplicities: cardinality pair -> operator.
export function getRelationshipOp (
  left: RelationCardinality,
  right: RelationCardinality,
): RelationshipOp {
  return CARDINALITY_TO_OP.get(`${left}-${right}`) ?? '<>';
}

// Cardinality transforms: adjust min or max while preserving the other.
// Used by code actions to suggest operator changes.

// Set min to 0 (allow null): 1 -> 0..1, * -> 0..*
export function makeCardinalityOptional (rel: RelationCardinality): RelationCardinality {
  const { min, max } = parseCardinality(rel);
  if (min === 0) return rel;
  return max === '*' ? CARDINALITY_MANY : CARDINALITY_MAYBE;
}

// Set min to 1 (require not null): 0..1 -> 1, 0..* -> *
export function makeCardinalityRequired (rel: RelationCardinality): RelationCardinality {
  const { min, max } = parseCardinality(rel);
  if (min >= 1) return rel;
  return max === '*' ? CARDINALITY_SOME : CARDINALITY_ONE;
}

// Set max to * (allow many): 1 -> *, 0..1 -> 0..*
export function makeCardinalityMany (rel: RelationCardinality): RelationCardinality {
  const { min, max } = parseCardinality(rel);
  if (max === '*') return rel;
  return min === 0 ? CARDINALITY_MANY : CARDINALITY_SOME;
}
