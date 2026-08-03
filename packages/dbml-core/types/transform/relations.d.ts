import type { NormalizedField } from '../model_structure/field';
import type { RelationCardinality } from '@dbml/parse';

export declare function inferMultiplicitiesFromColumns (
  sourceColumn: NormalizedField,
  targetColumn: NormalizedField,
): [RelationCardinality, RelationCardinality];
