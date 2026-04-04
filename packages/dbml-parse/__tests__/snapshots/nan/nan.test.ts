import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Compiler } from '@/index';
import { UNHANDLED } from '@/constants';
import { scanTestNames } from '../../utils';

// The legacy snapshot tests are very prone to breakage
// Do not add more tests here
describe('[legacy - snapshot] interpreter (NaN cases)', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);
    let output: any;

    const ast = compiler.parseFile().getValue().ast;
    const bindResult = compiler.bind(ast);
    const bindErrors = [...compiler.parseFile().getErrors(), ...bindResult.getErrors()];

    if (bindErrors.length !== 0) {
      output = JSON.stringify(
        bindErrors,
        (key, value) => (['symbol', 'references', 'referee', 'parent', 'parentNode'].includes(key) ? undefined : value),
        2,
      );
    } else {
      const res = compiler.interpret(ast);
      if (res.hasValue(UNHANDLED)) {
        output = JSON.stringify(undefined, null, 2);
      } else if (res.getErrors().length > 0) {
        output = JSON.stringify(
          res.getErrors(),
          (key, value) => (['symbol', 'references', 'referee', 'parent', 'parentNode'].includes(key) ? undefined : value),
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
