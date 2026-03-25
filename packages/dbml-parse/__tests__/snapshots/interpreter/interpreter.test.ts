import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Compiler } from '@/index';
import Interpreter from '@/core/interpreter/interpreter';
import { scanTestNames } from '@tests/utils';

describe('[snapshot] interpreter', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);
    let output: any;

    const analyzeReport = compiler.parseFile().chain(() => compiler.analyzeFile());

    if (analyzeReport.getErrors().length !== 0) {
      output = JSON.stringify(
        analyzeReport.getErrors(),
        (key, value) => (['symbol', 'references', 'referee', 'parent'].includes(key) ? undefined : value),
        2,
      );
    } else {
      const res = new Interpreter(compiler).interpret();
      if (res.getErrors().length > 0) {
        output = JSON.stringify(
          res.getErrors(),
          (key, value) => (['symbol', 'references', 'referee', 'parent'].includes(key) ? undefined : value),
          2,
        );
      } else {
        output = JSON.stringify(
          res.getValue(),
          (key, value) => (['symbol', 'references', 'referee'].includes(key) ? undefined : value),
          2,
        );
      }
    }

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
