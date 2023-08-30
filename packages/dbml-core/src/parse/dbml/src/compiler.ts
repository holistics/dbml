import { CompileError } from './lib/errors';
import { ProgramNode, SyntaxNodeIdGenerator } from './lib/parser/nodes';
import { NodeSymbolIdGenerator } from './lib/analyzer/symbol/symbols';
import Report from './lib/report';
import Lexer from './lib/lexer/lexer';
import Parser from './lib/parser/parser';
import Analyzer from './lib/analyzer/analyzer';
import Interpreter from './lib/interpreter/interpreter';
import Database from '../../../model_structure/database';

export default class Compiler {
  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  emitRawDbFromDBML(source: string): Database {
    const parseRes = this.parseFromSource(source);
    const parseErrors = parseRes.getErrors();
    if (parseErrors.length > 0) {
      throw parseErrors;
    }

    const parseValue = parseRes.getValue();
    const intepreter = new Interpreter(parseValue);
    const interpretRes = intepreter.interpret();
    const interpretErrors = interpretRes.getErrors();
    if (interpretErrors.length > 0) {
      throw interpretErrors;
    }

    return new Database(interpretRes.getValue());
  }

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
