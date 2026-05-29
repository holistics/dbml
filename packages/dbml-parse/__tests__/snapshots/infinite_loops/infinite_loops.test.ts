import {
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  describe, it,
} from 'vitest';
import {
  scanTestNames,
} from '@tests/utils';
import { DEFAULT_ENTRY } from '@/constants';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

const TIMEOUT_MS = 10_000;

describe('[snapshot] infinite_loops', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    it(testName, () => {
      const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

      const layout = new MemoryProjectLayout();
      layout.setSource(DEFAULT_ENTRY, program);
      const compiler = new Compiler(layout);
      compiler.interpretFile(DEFAULT_ENTRY);
    }, TIMEOUT_MS);
  });
});
