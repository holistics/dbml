import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { serialize } from '@/lib/serialization/serialize';
import { scanTestNames } from '@/../tests/jestHelpers';
import { NodeSymbolIdGenerator } from '@/lib/analyzer/symbol/symbols';
import { SyntaxNodeIdGenerator } from '@/lib/parser/nodes';
import Lexer from '@/lib/lexer/lexer';
import Parser from '@/lib/parser/parser';
import Validator from '@/lib/analyzer/validator/validator';
import SymbolFactory from '@/lib/analyzer/symbol/factory';

describe('#validator', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const symbolIdGenerator = new NodeSymbolIdGenerator();
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    const report = new Lexer(program)
      .lex()
      .chain((tokens) => {
        return new Parser(tokens, nodeIdGenerator).parse();
      })
      .chain(({ ast }) => {
        return new Validator(ast, new SymbolFactory(symbolIdGenerator)).validate();
      });
    const output = serialize(report, true);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
