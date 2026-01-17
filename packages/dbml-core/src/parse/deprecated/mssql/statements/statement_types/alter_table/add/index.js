const P = require('parsimmon');
const KP = require('../../../../keyword_parsers');
const { pIdentifier } = require('../../../../base_parsers');
const { makeNode, makeList } = require('../../../../utils');
const A = require('./actions');
const { pTableConstraintFK } = require('../../../../fk_definition');
const { pTableConstraintIndex } = require('../../../../index_definition');
const { pConstraintCheck, pConstExpr, pConstraintName } = require('../../../../constraint_definition');
const { pColumnsDefinition } = require('../../../../column_definition');

const Lang = P.createLanguage({
  AddAction: (r) => P.seq(KP.KeywordAdd, r.AddOption.sepBy1(KP.Comma)).map((value) => value[1]),
  AddOption: (r) => P.alt(r.AddConstraint, pColumnsDefinition.result(null), r.IgnoredAddSystemTimeOption.result(null)),

  IgnoredAddSystemTimeOption: () => P.alt(pIdentifier, P.regexp(/[(),]/)).many(),
  AddConstraint: (r) => P.seqMap(
    pConstraintName.fallback(null),
    r.AddConstraintOption,
    A.makeTableConstraint,
  ).thru(makeNode()),
  AddConstraintOption: (r) => P.alt(
    pTableConstraintFK,
    pTableConstraintIndex,
    pConstraintCheck,
    r.AddConstraintDefault,
    r.IgnoredAddConstraintOption.result(null),
  ),

  IgnoredAddConstraintOption: (r) => P.alt(
    r.AddConstraintConnection,
  ),

  AddConstraintDefault: () => P.seqMap(
    KP.KeywordDefault,
    pConstExpr,
    KP.KeywordFor,
    pIdentifier,
    KP.KeywordWithValues.fallback(null),
    A.makeDefault,
  ),

  AddConstraintConnection: () => P.seq(
    KP.KeywordConnection,
    makeList(P.seq(pIdentifier, KP.KeywordTo, pIdentifier)),
  ),
});
module.exports = Lang.AddAction;
