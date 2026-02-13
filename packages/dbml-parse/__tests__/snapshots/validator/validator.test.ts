import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { serialize, scanTestNames } from '@tests/utils';

describe('[snapshot] validator', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const symbolIdGenerator = new NodeSymbolIdGenerator();
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    const report = new Lexer(program)
      .lex()
      .chain((tokens) => {
        return new Parser(program, tokens, nodeIdGenerator).parse();
      })
      .chain(({ ast }) => {
        return new Validator(ast, new SymbolFactory(symbolIdGenerator)).validate();
      });
    const output = serialize(report, true);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
