declare function _export(str: String, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql'): string;
declare const _default: {
    export: typeof _export;
};
export default _default;
