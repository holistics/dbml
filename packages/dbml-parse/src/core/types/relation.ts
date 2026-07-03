type BaseRelationshipOp = '>' | '<' | '-' | '<>';
export type RelationshipOp = `${'?' | ''}${BaseRelationshipOp}${'?' | ''}`;

// A cardinality is either:
//   - a single number: exactly N (for backwards compatibility)
//   - '*': shorthand for 1..* (for backwards compatibility)
//   - 'min..max': a range (e.g. '0..1', '1..*', '2..5')
export type RelationCardinality = `${number}` | '*' | `${number}..${number | '*'}`;

// Collapse 'N..N' to just 'N' when min equals max
// This is for backwards compatibility:
// - '1': 1..1
// - '*': 1..many
export function normalizeCardinality (c: RelationCardinality): RelationCardinality {
  if (c === '*') return c;
  const { min, max } = parseCardinality(c);
  if (typeof max === 'number' && min === max) return `${min}` as RelationCardinality;
  return c;
}

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

export const RELATIONSHIP_OPS: ReadonlySet<RelationshipOp> = new Set<RelationshipOp>([
  '-',
  '<>',
  '>',
  '<',
  '-?',
  '?-',
  '?-?',
  '?>',
  '>?',
  '?>?',
  '?<',
  '<?',
  '?<?',
  '?<>',
  '<>?',
  '?<>?',
]);

export const CARDINALITY_ONE: RelationCardinality = '1';
export const CARDINALITY_MAYBE: RelationCardinality = '0..1';
export const CARDINALITY_SOME: RelationCardinality = '*'; // Equivalent to '1..*'
export const CARDINALITY_MANY: RelationCardinality = '0..*';

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] | undefined {
  switch (op) {
    case '-': return [
      CARDINALITY_ONE,
      CARDINALITY_ONE,
    ];
    case '<>': return [
      CARDINALITY_SOME,
      CARDINALITY_SOME,
    ];
    case '>': return [
      CARDINALITY_SOME,
      CARDINALITY_ONE,
    ];
    case '<': return [
      CARDINALITY_ONE,
      CARDINALITY_SOME,
    ];
    // optional-one variants
    case '-?': return [
      CARDINALITY_ONE,
      CARDINALITY_MAYBE,
    ];
    case '?-': return [
      CARDINALITY_MAYBE,
      CARDINALITY_ONE,
    ];
    case '?-?': return [
      CARDINALITY_MAYBE,
      CARDINALITY_MAYBE,
    ];
    // directional with optional side
    case '?>': return [
      CARDINALITY_MANY,
      CARDINALITY_ONE,
    ];
    case '>?': return [
      CARDINALITY_SOME,
      CARDINALITY_MAYBE,
    ];
    case '?>?': return [
      CARDINALITY_MANY,
      CARDINALITY_MAYBE,
    ];
    case '?<': return [
      CARDINALITY_MAYBE,
      CARDINALITY_SOME,
    ];
    case '<?': return [
      CARDINALITY_ONE,
      CARDINALITY_MANY,
    ];
    case '?<?': return [
      CARDINALITY_MAYBE,
      CARDINALITY_MANY,
    ];
    // optional-many variants
    case '?<>': return [
      CARDINALITY_MANY,
      CARDINALITY_SOME,
    ];
    case '<>?': return [
      CARDINALITY_SOME,
      CARDINALITY_MANY,
    ];
    case '?<>?': return [
      CARDINALITY_MANY,
      CARDINALITY_MANY,
    ];
    default:
      return undefined;
  }
}

// Reverse of getMultiplicities: cardinality pair -> operator.
export function getRelationshipOp (
  left: RelationCardinality,
  right: RelationCardinality,
): RelationshipOp {
  const { min: leftMin, max: leftMax } = parseCardinality(left);
  const { min: rightMin, max: rightMax } = parseCardinality(right);

  // Left is [1..1] (CARDINALITY_ONE)
  if (leftMin === 1 && leftMax === 1) {
    // Right is [1..1] (CARDINALITY_ONE)
    if (rightMin === 1 && rightMax === 1) return '-';
    // Right is [0..1] (CARDINALITY_MAYBE)
    if (rightMin === 0 && rightMax === 1) return '-?';
    // Right is [0..*] (CARDINALITY_MANY)
    if (rightMin === 0 && rightMax === '*') return '<?';
    // Right is [1..*] (CARDINALITY_SOME)
    if (rightMin >= 1 && rightMax === '*') return '<';
  }

  // Left is [0..1] (CARDINALITY_MAYBE)
  if (leftMin === 0 && leftMax === 1) {
    // Right is [1..1] (CARDINALITY_ONE)
    if (rightMin === 1 && rightMax === 1) return '?-';
    // Right is [0..1] (CARDINALITY_MAYBE)
    if (rightMin === 0 && rightMax === 1) return '?-?';
    // Right is [0..*] (CARDINALITY_MANY)
    if (rightMin === 0 && rightMax === '*') return '?<?';
    // Right is [1..*] (CARDINALITY_SOME)
    if (rightMin >= 1 && rightMax === '*') return '?<';
  }

  // Left is [0..*]
  if (leftMin === 0 && leftMax === '*') {
    // Right is [1..1] (CARDINALITY_ONE)
    if (rightMin === 1 && rightMax === 1) return '?>';
    // Right is [0..1] (CARDINALITY_MAYBE)
    if (rightMin === 0 && rightMax === 1) return '?>?';
    // Right is [0..*]
    if (rightMin === 0 && rightMax === '*') return '?<>?';
    // Right is [1..*] (CARDINALITY_SOME)
    if (rightMin >= 1 && rightMax === '*') return '?<>';
  }

  // Left is [1..*] (CARDINALITY_SOME / CARDINALITY_MANY)
  if (leftMin >= 1 && leftMax === '*') {
    // Right is [1..1] (CARDINALITY_ONE)
    if (rightMin === 1 && rightMax === 1) return '>';
    // Right is [0..1] (CARDINALITY_MAYBE)
    if (rightMin === 0 && rightMax === 1) return '>?';
    // Right is [0..*]
    if (rightMin === 0 && rightMax === '*') return '<>?';
    // Right is [1..*] (CARDINALITY_SOME)
    if (rightMin >= 1 && rightMax === '*') return '<>';
  }

  return '<>';
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
