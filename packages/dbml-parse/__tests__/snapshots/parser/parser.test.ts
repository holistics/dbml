import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProgramNode } from '@/core/parser/nodes';
import { scanTestNames, toSnapshot } from '@tests/utils';
import Compiler from '@/compiler';
import type Report from '@/core/report';

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

// The legacy snapshot tests are very prone to breakage
// Do not add more tests here
describe('[legacy - snapshot] parser', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);

    const output = serializeParserResult(
      compiler,
      compiler.parseFile().map(({ ast }) => ast),
    );
    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
