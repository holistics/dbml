import {
  DEFAULT_ENTRY,
} from '@/constants';
import {
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  describe, expect, it,
} from 'vitest';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import {
  scanTestNames, toSnapshot,
} from '@tests/utils';
import Compiler from '@/compiler';
import type Report from '@/core/types/report';

function serializeParserResult (compiler: Compiler, report: Report<ProgramNode>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  return JSON.stringify(toSnapshot(compiler, {
    program: value,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] parser', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);

    // @ts-expect-error "Current workaround to use compiler but only trigger validator"
    const {
      nodeIdGenerator,
    } = compiler;

    const lexer = new Lexer(program, DEFAULT_ENTRY);
    const output = serializeParserResult(
      compiler,
      lexer.lex().chain((tokens) => {
        const parser = new Parser(program, tokens, nodeIdGenerator, DEFAULT_ENTRY);
        return parser.parse().map((_) => _.ast);
      }),
    );
    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
