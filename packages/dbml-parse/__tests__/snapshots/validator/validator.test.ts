import { DEFAULT_ENTRY } from '@/constants';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  describe, expect, it,
} from 'vitest';
import type { ProgramNode } from '@/core/types/nodes';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/types/symbol/factory';
import {
  scanTestNames, toSnapshot,
} from '@tests/utils';
import Compiler from '@/compiler';
import type Report from '@/core/types/report';

function serializeValidatorResult (compiler: Compiler, report: Report<ProgramNode>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  return JSON.stringify(toSnapshot(compiler, {
    program: value,
    errors,
    warnings,
  }, { includeSymbols: false }), null, 2);
}

describe('[snapshot] validator', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);

    // @ts-expect-error "Current workaround to use compiler but only trigger analyzer"
    const {
      nodeIdGenerator, symbolIdGenerator,
    } = compiler;

    const report = new Lexer(program, DEFAULT_ENTRY)
      .lex()
      .chain((tokens) => {
        return new Parser(program, tokens, nodeIdGenerator, DEFAULT_ENTRY).parse();
      })
      .chain(({ ast }) => {
        return new Validator(ast, new SymbolFactory(symbolIdGenerator)).validate();
      });
    const output = serializeValidatorResult(compiler, report);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
