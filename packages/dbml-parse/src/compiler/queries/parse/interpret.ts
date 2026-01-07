import type Compiler from '../../index';
import { ProgramNode } from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { CompileError } from '@/core/errors';
import Report from '@/core/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import Analyzer from '@/core/analyzer/analyzer';
import Interpreter from '@/core/interpreter/interpreter';
import { Database } from '@/core/interpreter/types';

export type InterpretResult = Report<
  Readonly<{ ast: ProgramNode; tokens: SyntaxToken[]; rawDb?: Database }>,
  CompileError
>;

export function interpret (this: Compiler): InterpretResult {
  const parseRes = new Lexer(this.source)
    .lex()
    .chain((tokens) => {
      const parser = new Parser(tokens as SyntaxToken[], this.nodeIdGenerator);

      return parser.parse();
    })
    .chain(({ ast, tokens }) => {
      const analyzer = new Analyzer(ast, this.symbolIdGenerator);

      return analyzer.analyze().map(() => ({ ast, tokens }));
    });

  if (parseRes.getErrors().length > 0) {
    return parseRes;
  }

  return parseRes.chain(({ ast, tokens }) => {
    const interpreter = new Interpreter(ast);

    return interpreter
      .interpret()
      .map((interpretedRes) => ({ ast, tokens, rawDb: interpretedRes }));
  });
}
