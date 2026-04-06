import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanTestNames, toSnapshot } from '@tests/utils';
import Compiler from '@/compiler';
import type { Database } from '@/index';
import type Report from '@/core/report';

function serializeInterpreterResult (compiler: Compiler, report: Report<Database | undefined>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  return JSON.stringify(toSnapshot(compiler, {
    database: value,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] nan', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);
    const report = compiler.parse._().map(({ rawDb }) => rawDb);

    it(testName, () => expect(serializeInterpreterResult(compiler, report)).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
