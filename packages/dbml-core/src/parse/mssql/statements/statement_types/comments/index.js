const P = require('parsimmon');
const KP = require('../../../keyword_parsers');
const A = require('./actions');
const { makeNode } = require('../../../utils');

const Lang = P.createLanguage({
  StartComment: () => P.seq(KP.KeywordExec, KP.KeywordSP_ADDEXTENDEDPROPERTY),
  EndComment: () => P.seq(KP.Semicolon.atMost(1), KP.KeywordGo),
  StartString: () => P.alt(KP.SingleQuote, P.string('N\'')),
  ManyDoubleSingleQuote: () => P.string('\'\''),
  NoSingleQuote: () => P.regex(/[^']/),
  StringType: (r) => P.alt(r.NoSingleQuote, r.ManyDoubleSingleQuote)
    .atLeast(1)
    .map((res) => res.join('')),
  NVarchar: (r) => r.StartString.then(r.StringType).skip(KP.SingleQuote),
  NameOption: (r) => KP.KeywordAtName.skip(KP.Equal).then(r.NVarchar),
  ValueOption: (r) => KP.KeywordAtValue.skip(KP.Equal).then(r.NVarchar),
  Level0Type: (r) => KP.KeywordAtLevel0Type.skip(KP.Equal).then(r.NVarchar),
  Level0Name: (r) => KP.KeywordAtLevel0Name.skip(KP.Equal).then(r.NVarchar),
  Level1Type: (r) => KP.KeywordAtLevel1Type.skip(KP.Equal).then(r.NVarchar),
  Level1Name: (r) => KP.KeywordAtLevel1Name.skip(KP.Equal).then(r.NVarchar),
  Level2Type: (r) => KP.KeywordAtLevel2Type.skip(KP.Equal).then(r.NVarchar),
  Level2Name: (r) => KP.KeywordAtLevel2Name.skip(KP.Equal).then(r.NVarchar),
  Level0Stmt: (r) => P.seqObj(['type', r.Level0Type], KP.Comma, ['name', r.Level0Name]),
  Level1Stmt: (r) => P.seqObj(['type', r.Level1Type], KP.Comma, ['name', r.Level1Name]),
  Level2Stmt: (r) => P.seqObj(['type', r.Level2Type], KP.Comma, ['name', r.Level2Name]),
  Level0Wrapper: (r) => P.alt(P.seq(r.Level0Stmt.skip(KP.Comma), r.Level1Wrapper), r.Level0Stmt)
    .map((res) => (Array.isArray(res) ? [res[0], ...res[1]] : [res]))
    .atMost(1)
    .map((res) => (res.length === 1 ? res[0] : res)),
  Level1Wrapper: (r) => P.alt(P.seq(r.Level1Stmt.skip(KP.Comma), r.Level2Stmt), r.Level1Stmt).map((res) => (Array.isArray(res) ? res : [res])),
  CommentSyntax: (r) => P.seqObj(
    r.StartComment,
    ['name', r.NameOption],
    KP.Comma,
    ['note', r.ValueOption],
    KP.Comma,
    ['level', r.Level0Wrapper],
    r.EndComment,
  ).map(A.handleComment).thru(makeNode()),
});

module.exports = Lang.CommentSyntax;
