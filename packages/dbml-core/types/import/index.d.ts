declare function _import(str: string, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'postgresLegacy'): string;

/**
 * @param {any} schemaJson
 * @description Type of schemaJson is `DatabaseSchema`.
 * The type definition of `DatabaseSchema` object can be found [here](https://github.com/holistics/dbml/blob/a4dcb110f1d79f5d95b0d3db4b919914439e039d/packages/dbml-connector/src/connectors/types.ts#L89)
 */
declare function generateDbml(schemaJson: any): string;
declare const _default: {
    import: typeof _import;
    generateDbml: typeof generateDbml;
};
export default _default;
