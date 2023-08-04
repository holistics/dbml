import antlr4 from 'antlr4';

export default class PostgreSQLParserBase extends antlr4.Parser {
  constructor (input) {
    super(input);
  }
}

export function ParseRoutineBody () {
}