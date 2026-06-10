import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Specify the file name in ./input/ to profile
// e.g. yarn profile -- 25k.dbml
const file = process.argv[2] || '25k.dbml';
const source = readFileSync(path.resolve(__dirname, '..', 'input', file), 'utf-8');

const layout = new MemoryProjectLayout();
layout.setSource(DEFAULT_ENTRY, source);
const compiler = new Compiler(layout);

console.log(`Profiling ${file}...`);

console.time(`interpretProject ${file}`);
compiler.interpretProject();
console.timeEnd(`interpretProject ${file}`);
