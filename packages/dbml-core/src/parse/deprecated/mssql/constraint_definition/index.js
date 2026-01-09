const P = require('parsimmon');
const KP = require('../keyword_parsers');
const pExpression = require('../expression');
const {
  pIdentifier, pConst, pFunction,
} = require('../base_parsers');
const { makeList, streamline, makeNode } = require('../utils');
const { pColumnConstraintFK, pTableConstraintFK } = require('../fk_definition');
const { pColumnConstraintIndex, pTableConstraintIndex } = require('../index_definition');
const A = require('./actions');

const Lang = P.createLanguage({
  TableConstraint: (r) => P.seqMap(
    r.ConstraintName.fallback(null),
    r.TableConstraintOption,
    A.makeTableConstraint,
  ).thru(makeNode()),

  TableConstraintOption: (r) => P.alt(
    pTableConstraintFK,
    pTableConstraintIndex,
    r.ConstraintCheck,
  ),
  ColumnConstraint: (r) => P.seq(r.ConstraintName.fallback(null), r.ColumnConstraintOption)
    .map((value) => value[1]),

  ColumnConstraintOption: (r) => P.alt(
    pColumnConstraintIndex,
    pColumnConstraintFK,
    r.ConstraintCheck,
    r.ConstraintDefault,
  ),

  ConstraintCheck: (r) => P.seq(
    KP.KeywordCheck,
    KP.KeywordNFR.fallback(null),
    r.ConstraintCheckExpr,
  ).map((value) => value[2]),

  ConstraintCheckExpr: (r) => P.alt(
    P.seq(
      KP.LParen.fallback(null),
      r.ConstraintCheckEnum,
      KP.RParen.fallback(null),
    ).map((value) => value[1]),
    pExpression.thru(streamline('expression')),
  ),

  ConstraintCheckEnum: () => P.seqMap(
    pIdentifier,
    KP.LogicalOpIn,
    makeList(pConst.thru(makeNode())),
    A.makeConstraintCheckEnum,
  ).thru(makeNode()),

  ConstraintDefault: (r) => P.seqMap(
    KP.KeywordDefault,
    r.ConstExpr,
    A.makeDefaultConstraint,
  ),

  ConstExpr: (r) => P.alt(
    P.seq(
      KP.LParen,
      r.ConstExpr,
      KP.RParen,
    ).map((value) => value[1]),
    pFunction,
    pConst,
    KP.KeywordNull.thru(streamline('boolean')),
  ),
  ConstraintName: () => P.seq(KP.KeywordConstraint, pIdentifier).map((value) => value[1]),
});

module.exports = {
  pColumnConstraint: Lang.ColumnConstraint,
  pTableConstraint: Lang.TableConstraint,
  pConstraintCheck: Lang.ConstraintCheck,
  pConstraintName: Lang.ConstraintName,
  pConstExpr: Lang.ConstExpr,
  makeTableConstraint: A.makeTableConstraint,
};
