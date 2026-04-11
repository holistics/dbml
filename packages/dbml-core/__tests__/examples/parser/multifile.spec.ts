import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import Parser from '../../../src/parse/Parser';
import { MemoryProjectLayout, Filepath } from '@dbml/parse';

const SAMPLES_DIR = path.resolve(__dirname, '../../../../dbml-parse/__tests__/samples');

function loadLayout (projectName: string): MemoryProjectLayout {
  const dir = path.join(SAMPLES_DIR, projectName);
  const layout = new MemoryProjectLayout();

  function walk (d: string) {
    for (const entry of readdirSync(d)) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.dbml')) {
        const rel = full.slice(dir.length); // e.g. /main.dbml
        layout.setSource(Filepath.from(rel), readFileSync(full, 'utf-8'));
      }
    }
  }

  walk(dir);
  return layout;
}

describe('@dbml/core multifile', () => {
  test('enum-across-files: parses enum defined in another file', () => {
    const layout = loadLayout('enum-across-files');
    const db = new Parser().parse(layout, 'dbmlv2');

    const allTables = db.schemas.flatMap((s) => s.tables);
    const jobs = allTables.find((t) => t.name === 'jobs');
    expect(jobs).toBeDefined();

    const statusField = jobs!.fields.find((f) => f.name === 'status');
    expect(statusField).toBeDefined();
    expect(statusField!.type.type_name).toBe('job_status');
  });

  test('wildcard-with-schema-tables: tables defined in entry file are accessible', () => {
    const layout = loadLayout('wildcard-with-schema-tables');
    // Should parse without errors and expose the locally-defined tables
    const db = new Parser().parse(layout, 'dbmlv2');

    const allTables = db.schemas.flatMap((s) => s.tables);
    expect(allTables.length).toBeGreaterThan(0);
  });

  test('non-dbmlv2 format rejects layout', () => {
    const layout = loadLayout('enum-across-files');
    expect(() => new Parser().parse(layout as any, 'mysql')).toThrow();
  });
});
