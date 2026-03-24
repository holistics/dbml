import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { NodeSymbolIdGenerator } from '@/core/validator/symbol/symbols';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Validator from '@/core/validator/validator';
import SymbolFactory from '@/core/validator/symbol/factory';
import { serializeAnalysis, scanTestNames } from '@tests/utils';

describe('[snapshot] validator', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const symbolIdGenerator = new NodeSymbolIdGenerator();
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    const report = new Lexer(program)
      .lex()
      .chain((tokens) => {
        return new Parser(DEFAULT_ENTRY, program, tokens, nodeIdGenerator).parse();
      })
      .chain(({ ast }) => {
        return new Validator({ ast, filepath: DEFAULT_ENTRY }, new SymbolFactory(symbolIdGenerator, DEFAULT_ENTRY))
          .validate()
          .map(({ nodeToSymbol }) => ({ ast, nodeToSymbol, nodeToReferee: new WeakMap(), symbolToReferences: new Map() }));
      });
    const output = serializeAnalysis(report, true);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
