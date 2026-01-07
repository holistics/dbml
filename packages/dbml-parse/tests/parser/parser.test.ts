import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { scanTestNames } from '../jestHelpers';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';

describe('#parser', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const lexer = new Lexer(program);
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    const output = JSON.stringify(
      lexer.lex().chain((tokens) => {
        const parser = new Parser(tokens, nodeIdGenerator);
        return parser.parse().map((_) => _.ast);
      }),
      null,
      2,
    );
    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
