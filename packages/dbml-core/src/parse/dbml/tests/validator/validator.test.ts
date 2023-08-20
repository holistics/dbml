import { Analyzer, Lexer, Parser } from '../../src/index';
import fs, { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { scanTestNames } from '../jestHelpers';
import { serialize } from '../../src/lib/serialization/serialize';

describe('#validator', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const lexer = new Lexer(program);
    const output = serialize(
      lexer
        .lex()
        .chain((tokens) => {
          const parser = new Parser(tokens);
          return parser.parse();
        })
        .chain((ast) => {
          const analyzer = new Analyzer(ast);
          return analyzer.validate();
        }),
    );
    it('should equal snapshot', () =>
      expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
