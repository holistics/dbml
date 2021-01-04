declare function _import(str: string, format: 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql'): string;
declare const _default: {
    import: typeof _import;
};
export default _default;
