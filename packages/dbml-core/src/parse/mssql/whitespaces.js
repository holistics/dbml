const P = require('parsimmon');

const Lang = P.createLanguage({
  WhiteSpaces: (r) => P.alt(r.WhiteSpace, r.InlineComment, r.MulLineComment).many(),
  WhiteSpace: () => P.regexp(/\s/),
  InlineComment: () => P.seq(P.string('--'), P.regexp(/[^\n\r]*/)),
  MulLineComment: () => P.seq(P.string('/*'), P.regexp(/[\s\S]*(?=\*\/)/), P.string('*/')),
});

module.exports = Lang.WhiteSpaces;
