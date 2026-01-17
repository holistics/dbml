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
    '!src/parse/deprecated/**/*.js',
    '!src/parse/ANTLR/parsers/**/*.js',
  ],
};

export default config;
