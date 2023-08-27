import { CompileError } from './lib/errors';
import { ProgramNode, SyntaxNodeIdGenerator } from './lib/parser/nodes';
import { NodeSymbolIdGenerator } from './lib/analyzer/symbol/symbols';
import Report from './lib/report';
import Lexer from './lib/lexer/lexer';
import Parser from './lib/parser/parser';
import Analyzer from './lib/analyzer/analyzer';

export default class Compiler {
  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  parseFromSource(source: string): Report<ProgramNode, CompileError> {
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();

    const lexer = new Lexer(source);

    return lexer
      .lex()
      .chain((tokens) => {
        const parser = new Parser(tokens, this.nodeIdGenerator);

        return parser.parse();
      })
      .chain((ast) => {
        const analyzer = new Analyzer(ast, this.symbolIdGenerator);

        return analyzer.analyze();
      });
  }
}
