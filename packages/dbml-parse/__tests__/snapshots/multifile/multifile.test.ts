import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';

// Each test case is a directory under input/ containing .dbml files.
// The entry file is always main.dbml. The snapshot captures the Model JSON.
function scanTestDirs (dirPath: string): string[] {
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function loadProject (testDir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(testDir)) {
    if (name.endsWith('.dbml')) {
      files[`/${name}`] = readFileSync(path.join(testDir, name), 'utf-8');
    }
  }
  return files;
}

const REPLACER = (key: string, value: unknown) =>
  ['symbol', 'references', 'referee', 'parent', 'filepath'].includes(key) ? undefined : value;

describe('[snapshot] multifile interpretation', () => {
  const inputDir = path.resolve(__dirname, './input');
  const testNames = scanTestDirs(inputDir);

  testNames.forEach((testName) => {
    const project = loadProject(path.join(inputDir, testName));
    const entries: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(project)) {
      entries[Filepath.from(filePath).intern()] = content;
    }
    const compiler = new Compiler(new MemoryProjectLayout(entries));
    const report = compiler.interpretFile(Filepath.from('/main.dbml'));

    let output: string;
    if (report.getErrors().length > 0) {
      output = JSON.stringify({
        errors: report.getErrors(),
        model: report.getValue(),
      }, REPLACER, 2);
    } else {
      output = JSON.stringify(report.getValue(), REPLACER, 2);
    }

    it(testName, () =>
      expect(output).toMatchFileSnapshot(
        path.resolve(__dirname, `./output/${testName}.out.json`),
      ));
  });
});
