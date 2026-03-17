import type Compiler from '../../index';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator, type ProgramNode } from '@/core/parser/nodes';
import { Filepath, type FilepathKey } from '../../projectLayout';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { CompileError, CompileWarning } from '@/core/errors';

export type FileIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
  readonly errors: readonly Readonly<CompileError>[];
  readonly warnings: readonly Readonly<CompileWarning>[];
};

const ROOT = Filepath.from('/');

export function parseFile (this: Compiler, filepath: Filepath): FileIndex {
  const layout = this.layout();
  const source = layout.getSource(filepath) ?? '';
  const nodeIdGenerator = new SyntaxNodeIdGenerator();
  const parseReport = new Lexer(source)
    .lex()
    .chain((tokens) => new Parser(source, tokens, nodeIdGenerator).parse());

  return {
    path: filepath,
    ast: parseReport.getValue().ast,
    tokens: parseReport.getValue().tokens,
    errors: parseReport.getErrors(),
    warnings: parseReport.getWarnings(),
  };
}

export function parseProject (this: Compiler): Map<FilepathKey, FileIndex> {
  const layout = this.layout();
  return new Map(
    layout.listAllFiles(ROOT)
      .filter((f) => f.extname === '.dbml')
      .map((filepath: Filepath) => [filepath.key, this.parseFile(filepath)] as const),
  );
}
