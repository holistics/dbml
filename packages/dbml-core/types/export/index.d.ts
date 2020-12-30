declare function _export(str: string, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql'): string;
declare const _default: {
    export: typeof _export;
};
export default _default;
