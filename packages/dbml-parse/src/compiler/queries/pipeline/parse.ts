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

export type FileParseIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
};

export function parseFile (this: Compiler, filepath: Filepath): Report<FileParseIndex> {
  const source = this.layout.getSource(filepath);
  return new Lexer(source ?? '', filepath)
    .lex()
    .chain((lexedTokens) => new Parser(source ?? '', lexedTokens, this.nodeIdGenerator, filepath).parse())
    .map(({
      ast, tokens,
    }) => ({
      ast,
      tokens,
      path: filepath,
    }));
}
