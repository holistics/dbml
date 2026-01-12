import { type Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testMatch: ['**/?(*.)+(spec|test).?([mc])[jt]s?(x)'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        moduleResolution: 'node',
      },
    }],
    '^.+\\.js$': ['babel-jest', { configFile: './.babelrc' }],
    '\\.(?!json$)[^.]*$': '@glen/jest-raw-loader',
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^lodash-es$': 'lodash',
  },
  collectCoverage: true,
  coverageReporters: ['json', 'json-summary', 'html', 'text'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/parse/buildParser.js',
    '!src/parse/dbmlParser.js',
    '!src/parse/mssqlParser.js',
    '!src/parse/mysqlParser.js',
    '!src/parse/postgresParser.js',
    '!src/parse/schemarbParser.js',
    '!src/parse/dbml/**/*.js',
    '!src/parse/mssql/**/*.js',
    '!src/parse/mysql/**/*.js',
    '!src/parse/postgresql/**/*.js',
    '!src/parse/schemarb/**/*.js',
    '!src/parse/ANTLR/parsers/**/*.js',
  ],
};

export default config;
