import { type Config } from 'jest';

const config: Config = {
  testMatch: ["**/?(*.)+(spec|test).?([mc])[jt]s?(x)"],
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  collectCoverage: true,
  coverageReporters: ['json', 'json-summary'],
  coverageDirectory: 'coverage',
};

export default config;
