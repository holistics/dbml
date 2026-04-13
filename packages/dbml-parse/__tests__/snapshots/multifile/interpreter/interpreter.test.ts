import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toSnapshot } from '@tests/utils';
import Compiler from '@/compiler';
import type Report from '@/core/types/report';
import type { MasterDatabase, SchemaElement } from '@/core/types';
import { loadAllSampleProjects } from '@tests/samples/loader';

function serializeInterpreterResult (compiler: Compiler, report: Report<MasterDatabase | SchemaElement | SchemaElement[] | undefined>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  return JSON.stringify(toSnapshot(compiler, {
    database: value as any,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] interpreter - master database', () => {
  const projects = loadAllSampleProjects();

  projects.forEach(({ name, files, compiler }) => {
    const masterDatabase = compiler.interpretProject();

    it(name, () => expect(serializeInterpreterResult(compiler, masterDatabase)).toMatchFileSnapshot(path.resolve(__dirname, `./output/${name}/master-database.out.json`)));

    const singleExports: Record<string, unknown> = {};
    for (const [filename, filepath] of files) {
      const singleDatabase = compiler.exportSchemaJson(filepath);
      singleExports[filename] = JSON.parse(serializeInterpreterResult(compiler, singleDatabase));
    }
    it(`${name} - single`, () => expect(JSON.stringify(singleExports, null, 2)).toMatchFileSnapshot(path.resolve(__dirname, `./output/${name}/single.out.json`)));
  });
});
