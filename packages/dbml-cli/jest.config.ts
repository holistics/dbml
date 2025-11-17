import { type Config } from 'jest';

const config: Config = {
  testMatch: ["**/?(*.)+(spec|test).?([mc])[jt]s?(x)"],
  preset: 'ts-jest',
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  collectCoverage: true,
  coverageReporters: ["json", "json-summary"],
  coverageDirectory: "coverage",
};

export default config;
