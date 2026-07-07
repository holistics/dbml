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
  /// TODO: Should we treat increment as unique + not null?
  /// As when we validate in ColumnSymbol, we do treat them as such...
  /// But i fear this may cause confusion
  const sourceUnique = sourceColumn.pk || sourceColumn.unique;
  const targetUnique = targetColumn.pk || targetColumn.unique;
  const sourceNotNull = sourceColumn.not_null || sourceColumn.pk;
  const targetNotNull = targetColumn.not_null || targetColumn.pk;

  const sourceCardinality: RelationCardinality = sourceUnique
    ? (targetNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE)
    : (targetNotNull ? CARDINALITY_SOME : CARDINALITY_MANY);

  const targetCardinality: RelationCardinality = targetUnique
    ? (sourceNotNull ? CARDINALITY_ONE : CARDINALITY_MAYBE)
    : (sourceNotNull ? CARDINALITY_SOME : CARDINALITY_MANY);

  return [
    sourceCardinality,
    targetCardinality,
  ];
}
