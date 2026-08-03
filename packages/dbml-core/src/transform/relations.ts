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

  let sourceCardinality: RelationCardinality;
  let targetCardinality: RelationCardinality;

  if (sourceUnique && targetUnique) {
    // One-to-one: ignore target nullability on source side.
    // Source (left/target by convention) always gets 0..1.
    // Target (right/source by convention) respects source nullability.
    sourceCardinality = CARDINALITY_MAYBE;
    targetCardinality = sourceNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE;
  } else if (!sourceUnique && !targetUnique) {
    // Many-to-many: consider nullability on both sides.
    sourceCardinality = targetNotNull ? CARDINALITY_SOME : CARDINALITY_MANY;
    targetCardinality = sourceNotNull ? CARDINALITY_SOME : CARDINALITY_MANY;
  } else {
    // One-to-many / many-to-one: the many side (not unique) always gets 0..*,
    // ignoring the other column's nullability. The one side respects nullability.
    sourceCardinality = sourceUnique
      ? (targetNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE)
      : CARDINALITY_MANY;
    targetCardinality = targetUnique
      ? (sourceNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE)
      : CARDINALITY_MANY;
  }

  return [
    sourceCardinality,
    targetCardinality,
  ];
}
