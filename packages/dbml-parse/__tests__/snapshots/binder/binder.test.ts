import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Compiler } from '@/index';
import { scanTestNames } from '@tests/utils';

describe('[snapshot] binder', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);
    const errors = compiler.analyzeFile().getErrors();
    const output = JSON.stringify(errors, null, 2);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
