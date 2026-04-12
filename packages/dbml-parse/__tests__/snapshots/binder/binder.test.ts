import { DEFAULT_ENTRY } from '@/constants';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  describe, expect, it,
} from 'vitest';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { ProgramNode } from '@/core/types/nodes';
import Analyzer from '@/core/analyzer/analyzer';
import { scanTestNames, toSnapshot } from '@tests/utils';
import type Report from '@/core/types/report';
import Compiler from '@/compiler';

function serializeBinderResult (compiler: Compiler, report: Report<ProgramNode>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  return JSON.stringify(toSnapshot(compiler, {
    program: value,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] binder', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);

    // @ts-expect-error "Current workaround to use compiler but only trigger analyzer"
    const { nodeIdGenerator, symbolIdGenerator } = compiler;

    const report = new Lexer(program, DEFAULT_ENTRY)
      .lex()
      .chain((tokens) => {
        return new Parser(program, tokens, nodeIdGenerator, DEFAULT_ENTRY).parse();
      })
      .chain(({ ast }) => {
        return new Analyzer(ast, symbolIdGenerator).analyze();
      });
    const output = serializeBinderResult(compiler, report);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
