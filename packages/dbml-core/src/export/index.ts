import ModelExporter from './ModelExporter';
import Parser from '../parse/Parser';
import { DbmlExporterFlags } from '../types';
import { JsonExporterFlags } from './JsonExporter';

export type ExportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';

export type ExportFlags =
  Partial<DbmlExporterFlags> &
  Partial<JsonExporterFlags>;

/**
 * @deprecated Passing a boolean as the third argument is deprecated. Use `ExportFlags` instead.
 */
function _export (
  str: string,
  format: ExportFormatOption,
  flags: boolean,
): string;

function _export (
  str: string,
  format: ExportFormatOption,
  flags?: ExportFlags,
): string;

function _export (
  str: string,
  format: ExportFormatOption,
  flags: ExportFlags | boolean = {
    isNormalized: true,
    includeRecords: true
  },
): string {
  const resolvedFlags = normalizeExportFlags(flags);
  const database = (new Parser()).parse(str, 'dbmlv2');
  return ModelExporter.export(database.normalize(), format, resolvedFlags);
}

export function normalizeExportFlags (
  flags: ExportFlags | boolean = {},
): Required<ExportFlags> {
  if (typeof flags === 'boolean') {
    return {
      isNormalized: flags,
      includeRecords: true,
    };
  }

  const {
    isNormalized = true,
    includeRecords = true,
  } = flags;

  return {
    isNormalized: isNormalized,
    includeRecords: includeRecords,
  };
}

export default {
  export: _export,
};
