import {
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  describe, expect, it,
} from 'vitest';
import {
  scanTestNames, toSnapshot,
} from '@tests/utils';
import { DEFAULT_ENTRY } from '@/constants';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import type { Database } from '@/core/types/schemaJson';
import type Report from '@/core/types/report';

function serializeInterpreterResult (compiler: Compiler, report: Report<Database | undefined>): string {
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  const value = errors.length > 0 ? undefined : report.getValue();
  return JSON.stringify(toSnapshot(compiler, {
    database: value as any,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] interpreter', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const layout = new MemoryProjectLayout();
    layout.setSource(DEFAULT_ENTRY, program);
    const compiler = new Compiler(layout);
    const report = compiler.interpretFile(DEFAULT_ENTRY);

    it(testName, () => expect(serializeInterpreterResult(compiler, report)).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
