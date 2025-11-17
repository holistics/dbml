import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { scanTestNames } from '../jestHelpers';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Analyzer from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';

describe('#interpreter - check for cases that previously cause NaN-positioned errors', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const symbolIdGenerator = new NodeSymbolIdGenerator();
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    let output: any;
    const report = new Lexer(program)
      .lex()
      .chain((tokens) => {
        return new Parser(tokens, nodeIdGenerator).parse();
      })
      .chain(({ ast }) => {
        return new Analyzer(ast, symbolIdGenerator).analyze();
      });

    if (report.getErrors().length !== 0) {
      output = JSON.stringify(
        report.getErrors(),
        (key, value) => (['symbol', 'references', 'referee', 'parent'].includes(key) ? undefined : value),
        2,
      );
    } else {
      const res = new Interpreter(report.getValue()).interpret();
      if (res.getErrors().length > 0) {
        output = JSON.stringify(
          res.getErrors(),
          (key, value) => (['symbol', 'references', 'referee', 'parent'].includes(key) ? undefined : value),
          2,
        );
      } else {
        output = JSON.stringify(
          res.getValue(),
          (key, value) => (['symbol', 'references', 'referee'].includes(key) ? undefined : value),
          2,
        );
      }
    }

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
