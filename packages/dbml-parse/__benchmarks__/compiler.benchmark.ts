import {
  readFileSync, readdirSync, writeFileSync, mkdirSync,
} from 'node:fs';
import path from 'node:path';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
// @ts-expect-error nodemark has no type declarations
import benchmark from 'nodemark';

const inputDir = path.resolve(__dirname, 'input');
const outputDir = path.resolve(__dirname, 'output');
mkdirSync(outputDir, { recursive: true });

const inputFiles = readdirSync(inputDir).filter((f) => f.endsWith('.dbml'));

function createCompiler (source: string): Compiler {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  return new Compiler(layout);
}

const operations = [
  'interpret',
] as const;

interface BenchResult {
  ms: number;
  error: number;
  count: number;
}

interface BenchReport {
  operations: string[];
  suites: Record<string, Record<string, BenchResult>>;
}

const report: BenchReport = {
  operations: [
    ...operations,
  ],
  suites: {},
};

inputFiles.forEach((file) => {
  const source = readFileSync(path.resolve(inputDir, file), 'utf-8');
  const name = path.basename(file, '.dbml');

  console.log(`Benchmarking ${name}...`);
  report.suites[name] = {};

  const benchmarks: Record<string, () => void> = {
    interpret: () => { createCompiler(source).interpretProject(); },
  };

  for (const op of operations) {
    const result = benchmark(benchmarks[op]);
    report.suites[name][op] = {
      ms: result.milliseconds(3),
      error: result.error,
      count: result.count,
    };
    console.log(`  ${op}: ${result.milliseconds(3)}ms ±${Math.round(result.error * 10000) / 100}% (${result.count} samples)`);
  }
});

writeFileSync(path.resolve(outputDir, 'bench.json'), JSON.stringify(report, null, 2));
console.log(`\nResults written to ${path.resolve(outputDir, 'bench.json')}`);
