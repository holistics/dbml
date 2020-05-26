const P = require('parsimmon');
const BP = require('../../base_parsers');
const {
  pIdentifier, pKeywordClusteredOrNon, pConst, pColumnNames, pDotDelimitedName, pComparsionOp,
} = require('../../composite_parsers');
const { makeNode, makeList } = require('../../utils');
const A = require('./actions');
const { pIgnoredIndexOption } = require('../../index_definition');

const Lang = P.createLanguage({

  CreateIndex: (r) => P.seqMap(
    BP.KeywordCreate,
    BP.KeywordUnique.fallback(null),
    pKeywordClusteredOrNon.fallback(null),
    BP.KeywordIndex,
    pIdentifier,
    BP.KeywordOn,
    pDotDelimitedName,
    pColumnNames,
    A.makeIndex,
  ).thru(makeNode()).skip(r.IgnoredCreateIndexOptions),
  IgnoredCreateIndexOptions: (r) => P.alt(pIgnoredIndexOption, r.IncludeIndexOption, r.WhereIndexOption).many(),

  IncludeIndexOption: () => P.seq(BP.KeywordInclude, pColumnNames),

  WhereIndexOption: (r) => P.seq(BP.KeywordWhere, r.FilterPredicate),
  FilterPredicate: (r) => P.seq(r.Conjunct, P.seq(BP.LogicalOpAnd, r.Conjunct).fallback(null)),
  Conjunct: (r) => P.alt(r.Disjunct, r.Comparsion),
  Disjunct: () => P.seq(pIdentifier, BP.KeywordIn, makeList(pConst)),
  Comparsion: () => P.seq(pIdentifier, pComparsionOp, pConst),

});

module.exports = Lang.CreateIndex;
