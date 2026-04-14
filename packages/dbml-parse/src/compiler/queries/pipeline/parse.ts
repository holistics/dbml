import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type Compiler from '../../index';
import {
  collectTransitiveDependencies,
} from '../utils';

export type FileParseIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
};

export function parseFile (this: Compiler, filepath: Filepath): Report<FileParseIndex> {
  const source = this.layout.getSource(filepath);
  return new Lexer(source ?? '', filepath)
    .lex()
    .chain((lexedTokens) => new Parser(filepath, source ?? '', lexedTokens, this.nodeIdGenerator).parse())
    .map(({
      ast, tokens,
    }) => ({
      ast,
      tokens,
      path: filepath,
    }));
}

export function parseProject (this: Compiler): Map<string, Report<FileParseIndex>> {
  const deps = collectTransitiveDependencies(this, this.layout.getEntryPoints());

  const result = new Map<string, Report<FileParseIndex>>();

  for (const d of deps) {
    const parseResult = this.parseFile(d);
    result.set(d.absolute, parseResult);
  }

  return result;
}
