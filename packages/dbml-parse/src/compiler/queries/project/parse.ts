import type Compiler from '../../index';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';
import { Filepath, type FilepathKey } from '../../projectLayout';
import { FileIndex } from '../../types';

const ROOT = Filepath.from('/');

export function parseFile (this: Compiler, filepath: Filepath): FileIndex {
  const layout = this.parse.layout();
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
  };
}

export function parseProject (this: Compiler): Map<FilepathKey, FileIndex> {
  const layout = this.parse.layout();
  return new Map(
    layout.listAllFiles(ROOT)
      .filter((f) => f.extname === '.dbml')
      .map((filepath) => [filepath.key, parseFile.call(this, filepath)] as const),
  );
}
