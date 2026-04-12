import { DEFAULT_ENTRY } from '@/constants';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  describe, expect, it,
} from 'vitest';
import Lexer from '@/core/lexer/lexer';
import {
  scanTestNames, toSnapshot,
} from '@tests/utils';
import Compiler from '@/compiler';
import type { SyntaxToken } from '@/index';
import type Report from '@/core/types/report';

function serializeLexerResult (compiler: Compiler, report: Report<SyntaxToken[]>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  return JSON.stringify(toSnapshot(compiler, {
    tokens: value,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] lexer', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);

    const lexer = new Lexer(program, DEFAULT_ENTRY);

    const output = serializeLexerResult(compiler, lexer.lex());

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
