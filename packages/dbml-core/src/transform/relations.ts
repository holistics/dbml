import type { NormalizedField } from '../../types/model_structure/field';
import type { RelationCardinality } from '@dbml/parse';
import {
  CARDINALITY_ONE,
  CARDINALITY_MAYBE,
  CARDINALITY_SOME,
  CARDINALITY_MANY,
} from '@dbml/parse';

// Infer the cardinality pair for a ref from column constraints.
// For each side:
//   - max is determined by own column uniqueness (unique/pk -> 1, otherwise -> *)
//   - min is determined by other column nullability (not_null -> 1, otherwise -> 0)
export function inferMultiplicitiesFromColumns (
  sourceColumn: NormalizedField,
  targetColumn: NormalizedField,
): [RelationCardinality, RelationCardinality] {
  const sourceUnique = sourceColumn.pk || sourceColumn.unique || sourceColumn.increment;
  const targetUnique = targetColumn.pk || targetColumn.unique || targetColumn.increment;
  const sourceNotNull = sourceColumn.not_null || sourceColumn.pk || sourceColumn.increment;
  const targetNotNull = targetColumn.not_null || targetColumn.pk || targetColumn.increment;

  const isManyToMany = !sourceUnique && !targetUnique;
  const isOneToOne = sourceUnique && targetUnique;

  // For one-to-many, many-to-one, and one-to-one: ignore target nullability on the source side.
  // The target being NOT NULL (e.g. PK) doesn't constrain the source cardinality min.
  // For many-to-many, still consider nullability on both sides.
  const sourceCardinality: RelationCardinality = sourceUnique
    ? (isOneToOne ? CARDINALITY_MAYBE : (targetNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE))
    : (isManyToMany ? (targetNotNull ? CARDINALITY_SOME : CARDINALITY_MANY) : CARDINALITY_MANY);

  const targetCardinality: RelationCardinality = targetUnique
    ? (sourceNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE)
    : (isManyToMany ? (sourceNotNull ? CARDINALITY_SOME : CARDINALITY_MANY) : CARDINALITY_MANY);

  return [
    sourceCardinality,
    targetCardinality,
  ];
}
