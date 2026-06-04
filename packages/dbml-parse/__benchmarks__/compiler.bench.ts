import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { bench, describe } from 'vitest';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import Lexer from '@/core/lexer/lexer';

const inputDir = path.resolve(__dirname, 'input');
const inputFiles = readdirSync(inputDir).filter((f) => f.endsWith('.dbml'));

function createCompiler (source: string): Compiler {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  return new Compiler(layout);
}

inputFiles.forEach((file) => {
  const source = readFileSync(path.resolve(inputDir, file), 'utf-8');
  const name = path.basename(file, '.dbml');

  describe(`[Lex] Benchmark ${name}`, () => {
    bench('lex', () => {
      const lexer = new Lexer(source, DEFAULT_ENTRY);
      lexer.lex();
    });
  });

  describe(`[Parse] Benchmark ${name}`, () => {
    bench('parse', () => {
      const compiler = createCompiler(source);
      compiler.parseFile(DEFAULT_ENTRY);
    });
  });

  describe(`[Validate] Benchmark ${name}`, () => {
    bench('validate', () => {
      const compiler = createCompiler(source);
      compiler.validateFile(DEFAULT_ENTRY);
    });
  });

  describe(`[Bind] Benchmark ${name}`, () => {
    bench('bind', () => {
      const compiler = createCompiler(source);
      compiler.bindProject();
    });
  });

  describe(`Interpret ${name}`, () => {
    bench('interpret', () => {
      const compiler = createCompiler(source);
      compiler.interpretProject();
    });
  });
});
