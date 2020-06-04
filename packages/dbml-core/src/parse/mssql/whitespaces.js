const P = require('parsimmon');

const Lang = P.createLanguage({
  WhiteSpaces: (r) => P.alt(r.WhiteSpace, r.InlineComment, r.MulLineComment).many().desc('whitespaces or comments'),
  WhiteSpace: () => P.regexp(/\s/).desc('whitespaces'),
  InlineComment: () => P.seq(P.string('--'), P.regexp(/[^\n\r]*/)).desc('comments'),
  MulLineComment: () => P.regexp(/\/\*[\s\S]+?\*\//).desc('comments'),
});

module.exports = Lang.WhiteSpaces;
