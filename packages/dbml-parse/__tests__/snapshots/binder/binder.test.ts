import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Compiler } from '@/index';
import Report from '@/core/report';
import { serialize, scanTestNames } from '@tests/utils';

// The legacy snapshot tests are very prone to breakage
// Do not add more tests here
describe('[legacy - snapshot] binder', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);
    const ast = compiler.parseFile().getValue().ast;
    const validateResult = compiler.validate(ast);
    const bindResult = compiler.bind(ast);
    const errors = [...compiler.parseFile().getErrors(), ...validateResult.getErrors(), ...bindResult.getErrors()];
    const report = new Report(ast, errors);
    const output = serialize(report, compiler, true);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
