declare function fetchSchema(connection: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}, format: 'postgres'): Promise<string>;
declare const _default: {
  fetchSchema: typeof fetchSchema;
};
export default _default;
