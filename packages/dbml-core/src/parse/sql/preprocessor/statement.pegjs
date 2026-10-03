// SQL Statement Splitter
// Splits SQL into individual statements respecting:
// - Dynamic delimiters (;, $$, custom via DELIMITER directive)
// - MSSQL GO batch separator
// - Single/double/backtick/square-bracket quoted strings
// - Dollar-quoted blocks (PostgreSQL)
// - Line comments (-- and #)
// - Block comments (/* ... */)
//
// Usage: parse(sql) or parse(sql, { delimiter: '$$' })

{
  let delim = options.delimiter || ';';
  let delimMatchStart = 0;
}

Input
  = first:Stmt rest:(Sep Stmt)* last:Sep? {
      const stmts = [first, ...rest.map(r => r[1])];
      return stmts.filter(s => s.trim());
    }

Stmt
  = chunks:Chunk+ { return chunks.join(''); }
  / '' { return ''; }

Sep
  = GoSep
  / DelimiterChange
  / DelimMatch

GoSep
  = LineBreak [ \t]* "GO"i [ \t]* &(LineBreak / !.) { return 'GO'; }
  / &{ return offset() === 0; } "GO"i [ \t]* &(LineBreak / !.) { return 'GO'; }

DelimiterChange
  = LineBreak [ \t]* "DELIMITER"i [ \t]+ d:DelimChars [ \t]* TrailingLineComment? &(LineBreak / !.) {
      delim = d;
      return 'DELIM';
    }
  / &{ return offset() === 0; } "DELIMITER"i [ \t]+ d:DelimChars [ \t]* TrailingLineComment? &(LineBreak / !.) {
      delim = d;
      return 'DELIM';
    }

TrailingLineComment
  = "--" [^\r\n]*
  / "#" [^\r\n]*

DelimChars
  = chars:[^ \t\r\n]+ { return chars.join(''); }

// Consume current delimiter: first char explicitly (so peggy sees progress),
// then validate and consume the rest via DelimRest.
DelimMatch
  = first:. &{
      delimMatchStart = offset() - 1;
      return input.startsWith(delim, delimMatchStart);
    } DelimRest { return delim; }

DelimRest
  = &{ return offset() < delimMatchStart + delim.length; } . DelimRest { return ''; }
  / &{ return offset() >= delimMatchStart + delim.length; } { return ''; }

Chunk
  = SingleQuoted
  / DoubleQuoted
  / BacktickQuoted
  / SquareBracketQuoted
  / DollarQuoted
  / BlockComment
  / LineComment
  / HashComment
  / PlainChar

SingleQuoted
  = "'" chars:([^'\\] / "\\". / "''")* "'" {
      return "'" + chars.map(c => Array.isArray(c) ? c.join('') : c).join('') + "'";
    }

DoubleQuoted
  = '"' chars:([^"\\] / "\\". / '""')* '"' {
      return '"' + chars.map(c => Array.isArray(c) ? c.join('') : c).join('') + '"';
    }

BacktickQuoted
  = "`" chars:[^`]* "`" { return "`" + chars.join('') + "`"; }

SquareBracketQuoted
  = "[" chars:[^\]]* "]" { return "[" + chars.join('') + "]"; }

DollarQuoted
  = open:DollarTag body:$((!DollarTag .)*) close:DollarTag &{ return open === close; } {
      return open + body + close;
    }

DollarTag
  = $("$" [a-zA-Z_]* "$")

BlockComment
  = "/*" body:$(("*" !"/" / [^*])*) "*/" { return "/*" + body + "*/"; }

LineComment
  = "--" text:$([^\r\n]*) { return "--" + text; }

HashComment
  = "#" text:$([^\r\n]*) { return "#" + text; }

PlainChar
  = !Sep c:. { return c; }

LineBreak
  = "\r\n" / "\n" / "\r"
