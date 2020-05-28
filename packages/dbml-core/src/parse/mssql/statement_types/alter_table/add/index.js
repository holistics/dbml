const P = require('parsimmon');
const BP = require('../../../base_parsers');
const { pIdentifier } = require('../../../composite_parsers');
const { makeNode, makeList } = require('../../../utils');
const A = require('./actions');
const { pTableConstraintFK } = require('../../../fk_definition');
const { pTableConstraintIndex } = require('../../../index_definition');
const { pConstraintCheck, pConstExpr, pConstraintName } = require('../../../constraint_definition');
const { pColumnsDefinition } = require('../../../column_definition');

const Lang = P.createLanguage({
  AddAction: (r) => P.seq(BP.KeywordAdd, r.AddOption).map(value => value[1]),
  AddOption: (r) => P.alt(r.AddConstraint, pColumnsDefinition.result(null), r.IgnoredAddSystemTimeOption.result(null)),

  IgnoredAddSystemTimeOption: () => P.alt(pIdentifier, P.regexp(/[(),]/)).many(),
  AddConstraint: (r) => P.seqMap(
    pConstraintName.fallback(null),
    r.AddConstraintOption,
    A.makeTableConstraint,
  ).thru(makeNode()),
  AddConstraintOption: (r) => P.alt(pTableConstraintFK, r.IgnoredAddConstraintOption),

  IgnoredAddConstraintOption: (r) => P.alt(
    pTableConstraintIndex,
    pConstraintCheck,
    r.AddConstraintDefault,
    r.AddConstraintConnection,
  ),

  AddConstraintDefault: () => P.seq(
    BP.KeywordDefault,
    pConstExpr,
    BP.KeywordFor,
    pIdentifier,
    BP.KeywordWithValues.fallback(null),
  ),

  AddConstraintConnection: () => P.seq(
    BP.KeywordConnection,
    makeList(P.seq(pIdentifier, BP.KeywordTo, pIdentifier)),
  ),
});
module.exports = Lang.AddAction;
