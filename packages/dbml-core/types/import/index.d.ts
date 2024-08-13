declare function _import(str: string, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'postgresLegacy'): string;
declare function generateDbml(schemaJson: string): string;
declare const _default: {
    import: typeof _import;
    generateDbml: typeof generateDbml;
};
export default _default;
