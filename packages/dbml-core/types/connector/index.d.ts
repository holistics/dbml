declare function _fetch(connection: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}, format: 'postgres'): Promise<string>;
declare const _default: {
  fetch: typeof _fetch;
};
export default _default;
