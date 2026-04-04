import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import { scanTestNames } from '@tests/utils';

// The legacy snapshot tests are very prone to breakage
// Do not add more tests here
describe('[legacy - snapshot] parser', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const lexer = new Lexer(program);
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    const output = JSON.stringify(
      lexer.lex().chain((tokens) => {
        const parser = new Parser(program, tokens, nodeIdGenerator);
        return parser.parse().map((_) => _.ast);
      }),
      (key: string, value: any) => {
        if (key === 'source' || key === 'parentNode') return undefined;
        return value;
      },
      2,
    );
    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
