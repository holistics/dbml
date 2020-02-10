StringLiteral "string"
  = '"' chars:DoubleStringCharacter* '"' {
      return chars.join('');
    }
  / "'" chars:SingleStringCharacter* "'" {
      return chars.join('');
    }
DoubleStringCharacter
  = '\\' '"' { return '"'; }
  / !'"' SourceCharacter { return text(); }

SingleStringCharacter
  = "''" { return "'"; }
  / !"'" SourceCharacter { return text(); }

SourceCharacter
  = .
