import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { scanTestNames } from '../../utils';
import { NodeSymbolIdGenerator } from '@/core/validator/symbol/symbols';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Validator from '@/core/validator/validator';
import Binder from '@/core/binder/binder';
import SymbolFactory from '@/core/validator/symbol/factory';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { SchemaSymbol } from '@/core/validator/symbol/symbols';
import Interpreter from '@/core/interpreter/interpreter';

describe('[snapshot] interpreter (NaN cases)', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const symbolIdGenerator = new NodeSymbolIdGenerator();
    const nodeIdGenerator = new SyntaxNodeIdGenerator();
    let output: any;
    const report = new Lexer(program)
      .lex()
      .chain((tokens) => {
        return new Parser(undefined, program, tokens, nodeIdGenerator).parse();
      })
      .chain(({ ast }) => {
        const symbolFactory = new SymbolFactory(symbolIdGenerator);
        const nodeToSymbol = new WeakMap();
        nodeToSymbol.set(ast, symbolFactory.create(SchemaSymbol, { symbolTable: new SymbolTable() }));
        return new Validator({ ast, filepath: DEFAULT_ENTRY }, symbolFactory).validate().chain(({ nodeToSymbol: nts }) => {
          return new Binder({ ast, nodeToSymbol: nts }, symbolFactory).resolve().map((nodeToReferee) => ({ ast, nodeToSymbol: nts, nodeToReferee }));
        });
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
