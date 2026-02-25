import type { DbmlExporterOptions } from '../export/DbmlExporter';

export type ImportFormat = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'postgresLegacy' | 'mssqlLegacy' | 'schemarb' | 'snowflake' | 'oracle';

export type ImportOptions = Partial<DbmlExporterOptions>;

export declare function normalizeImportOptions(options: ImportOptions): Required<ImportOptions>;

declare function _import(str: string, format: ImportFormat, options?: ImportOptions): string;

/**
 * @param schemaJson
 * @description Type of schemaJson is `DatabaseSchema`.
 * The type definition of `DatabaseSchema` object can be found [here](https://github.com/holistics/dbml/blob/a4dcb110f1d79f5d95b0d3db4b919914439e039d/packages/dbml-connector/src/connectors/types.ts#L89)
 */
declare function generateDbml(schemaJson: unknown): string;

declare const _default: {
    import: typeof _import;
    generateDbml: typeof generateDbml;
};
export default _default;
