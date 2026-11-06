import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { Filepath } from '@/core/types/filepath';
import { type ProgramNode, UseDeclarationNode, UseSpecifierListNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SyntaxToken } from '@/core/types/tokens';
import type Compiler from '../../index';
import { collectTransitiveDependencies } from '../utils';

export type FileParseIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
};

export function parseFile (this: Compiler, filepath: Filepath): Report<FileParseIndex> {
  const source = this.getSource(filepath) ?? '';
  const lexerOptions = this.lexerOptions();
  return new Lexer(source, filepath, lexerOptions)
    .lex()
    .chain((lexedTokens) => {
      // The kind is read from the tokens before the parser attaches invalid tokens to them
      const kind = this.fileKindForParse(filepath, lexerOptions.allowFrontMatter ? lexedTokens : undefined);
      return new Parser(source, lexedTokens, this.nodeIdGenerator, filepath, this.parserOptions(kind)).parse()
        .map((parsed) => {
          if (kind === 'arch' && !this.explicitModules) markArchImports(parsed.ast);
          return parsed;
        });
    })
    .map(({
      ast, tokens,
    }) => ({
      ast,
      tokens,
      path: filepath,
    }));
}

// The kind words in an architecture file's `use` lines are read as roles
function markArchImports (ast: ProgramNode): void {
  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !(node.specifiers instanceof UseSpecifierListNode)) continue;
    for (const specifier of node.specifiers.specifiers) specifier.archImport = true;
  }
}

export function parseProject (this: Compiler): Map<string, Report<FileParseIndex>> {
  const deps = collectTransitiveDependencies(this, this.layout.getEntrypoints());

  const result = new Map<string, Report<FileParseIndex>>();

  for (const d of deps) {
    const parseResult = this.parseFile(d);
    result.set(d.absolute, parseResult);
  }

  return result;
}
