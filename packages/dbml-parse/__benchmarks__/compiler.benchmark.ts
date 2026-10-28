import {
  readFileSync, readdirSync, writeFileSync, mkdirSync,
} from 'node:fs';
import path from 'node:path';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
// @ts-expect-error nodemark has no type declarations
import benchmark from 'nodemark';

const inputDirectory = path.resolve(__dirname, 'input');
const outputDirectory = path.resolve(__dirname, 'output');
mkdirSync(outputDirectory, { recursive: true });

const inputFiles = readdirSync(inputDirectory).filter((file) => file.endsWith('.dbml'));

const report: Record<string, { ms: number; error: number; count: number }> = {};

for (const file of inputFiles) {
  const source = readFileSync(path.resolve(inputDirectory, file), 'utf-8');
  const name = path.basename(file, '.dbml');

  console.log(`Benchmarking ${name}...`);
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  const result = benchmark(() => { new Compiler(layout).interpretProject(); });

  report[name] = {
    ms: result.milliseconds(3),
    error: result.error,
    count: result.count,
  };

  const error = Math.round(result.error * 10000) / 100;
  console.log(`  ${result.milliseconds(3)}ms ±${error}% (${result.count} samples)`);
}

writeFileSync(path.resolve(outputDirectory, 'bench.json'), JSON.stringify(report, null, 2));
console.log(`\nResults written to ${path.resolve(outputDirectory, 'bench.json')}`);
