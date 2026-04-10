import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProgramNode } from '@/core/types/nodes';
import { scanTestNames, toSnapshot } from '@tests/utils';
import Compiler from '@/compiler';

function serializeValidatorResult (compiler: Compiler, ast: ProgramNode): string {
  const errors = compiler.parse.errors();
  const warnings = compiler.parse.warnings();
  return JSON.stringify(toSnapshot(compiler, {
    program: ast,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] validator', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(program);
    const ast = compiler.parse.ast();
    const output = serializeValidatorResult(compiler, ast);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
