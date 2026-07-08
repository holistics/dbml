import { MetadataTargetKind } from '@/core/types/symbol';
import type { MetadataFieldRegistry, MetadataTarget } from './metadataField';
import { TABLE_METADATA_FIELDS, COLUMN_METADATA_FIELDS } from '../table/interpret';
import { TABLEGROUP_METADATA_FIELDS } from '../tableGroup/interpret';
import { NOTE_METADATA_FIELDS } from '../note/interpret';

// Routing map: one registry entry per target kind. Replaces both
// METADATA_VALIDATE_MAPS (local validate side) and METADATA_ASSIGN_MAPS
// (program interpret side). Type erases to <any> here; consumers already
// do dynamic key lookup.
export const METADATA_FIELDS_BY_KIND: Partial<Record<MetadataTargetKind, MetadataFieldRegistry<any, any>>> = {
  [MetadataTargetKind.Table]: TABLE_METADATA_FIELDS,
  [MetadataTargetKind.Column]: COLUMN_METADATA_FIELDS,
  [MetadataTargetKind.TableGroup]: TABLEGROUP_METADATA_FIELDS,
  [MetadataTargetKind.Note]: NOTE_METADATA_FIELDS,
};

export type { MetadataFieldRegistry, MetadataTarget };
