import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Lexer from '@/core/lexer/lexer';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { scanTestNames } from '@tests/utils';

describe('[snapshot] lexer', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const lexer = new Lexer(program, DEFAULT_ENTRY);
    const output = JSON.stringify(lexer.lex(), (key, value) => key === 'filepath' ? undefined : value, 2);
    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
