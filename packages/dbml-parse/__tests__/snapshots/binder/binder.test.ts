import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProgramNode } from '@/core/parser/nodes';
import { scanTestNames, toSnapshot } from '@tests/utils';
import Report from '@/core/types/report';
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

    const astReport = compiler.parseFile().map(({ ast }) => ast);
    const validateReport = compiler.validate(astReport.getValue());
    const bindReport = compiler.bind(astReport.getValue());
    const output = serializeBinderResult(
      compiler,
      Report.create(
        astReport.getValue(),
        [...astReport.getErrors(), ...validateReport.getErrors(), ...bindReport.getErrors()],
        [...astReport.getWarnings(), ...validateReport.getWarnings(), ...bindReport.getWarnings()],
      ),
    );

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
