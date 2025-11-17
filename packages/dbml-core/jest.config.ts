import { type Config } from 'jest';

const config: Config = {
  setupFiles: [
    './jestHelpers.js',
  ],
  transform: {
    '^.+\\.js$': 'babel-jest',
    '\\.(?!json$)[^.]*$': '@glen/jest-raw-loader',
  },
  moduleNameMapper: {
    '^lodash-es$': 'lodash',
  },
  collectCoverage: true,
  coverageReporters: ["json"],
  coverageDirectory: "coverage",
};

export default config;
