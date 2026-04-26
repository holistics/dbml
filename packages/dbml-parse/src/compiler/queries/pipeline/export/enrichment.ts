import {
  cloneDeep,
} from 'lodash-es';
import type {
  Database, Ref, TableRecord,
} from '@/core/types/schemaJson';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';

// Pull cross-file refs and records into a consumer's reconciled Database.
export function enrichWithCrossFileElements (
  reconciled: Database,
  allItems: Database,
  fileDb: Database,
): void {
  // Build visibility from ORIGINAL names (before aliasing).
  const visibleTables = new Set<string>();
  for (const t of fileDb.tables) {
    visibleTables.add(`${t.schemaName ?? DEFAULT_SCHEMA_NAME}\0${t.name}`);
  }
  for (const ext of fileDb.externals.tables) {
    visibleTables.add(`${ext.schemaName ?? DEFAULT_SCHEMA_NAME}\0${ext.name}`);
  }

  // Cross-file refs: include when BOTH endpoints are visible
  const localRefSources = new Set<Ref>(fileDb.refs);
  for (const ref of allItems.refs) {
    if (localRefSources.has(ref)) continue;
    if (ref.endpoints.every((ep) => visibleTables.has(`${ep.schemaName ?? DEFAULT_SCHEMA_NAME}\0${ep.tableName}`))) {
      reconciled.refs.push(cloneDeep(ref));
    }
  }

  // Cross-file records: include when target table is visible
  const localRecordSources = new Set<TableRecord>(fileDb.records);
  for (const rec of allItems.records) {
    if (localRecordSources.has(rec)) continue;
    if (visibleTables.has(`${rec.schemaName ?? DEFAULT_SCHEMA_NAME}\0${rec.tableName}`)) {
      reconciled.records.push(cloneDeep(rec));
    }
  }
}
