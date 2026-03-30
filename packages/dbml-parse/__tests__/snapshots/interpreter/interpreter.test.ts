import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Compiler } from '@/index';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { scanTestNames } from '@tests/utils';

describe('[snapshot] interpreter', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);
    const res = compiler.interpretProject();
    let output: any;

    if (res.getErrors().length > 0) {
      output = JSON.stringify(
        res.getErrors(),
        (key, value) => (['symbol', 'references', 'referee', 'parent', 'filepath'].includes(key) ? undefined : value),
        2,
      );
    } else {
      output = JSON.stringify(
        res.getValue().databases[0],
        (key, value) => (['symbol', 'references', 'referee', 'filepath'].includes(key) ? undefined : value),
        2,
      );
    }

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
