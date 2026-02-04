const P = require('parsimmon');
const KP = require('../../../keyword_parsers.cjs');
const {
  pIdentifier, pKeywordClusteredOrNon, pConst, pColumnNames, pDotDelimitedName, pComparsionOp,
} = require('../../../base_parsers.cjs');
const { makeNode, makeList } = require('../../../utils.cjs');
const A = require('./actions.cjs');
const { pIgnoredIndexOption } = require('../../../index_definition/index.cjs');

const Lang = P.createLanguage({

  CreateIndex: (r) => P.seqMap(
    KP.KeywordCreate,
    KP.KeywordUnique.fallback(null),
    pKeywordClusteredOrNon.fallback(null),
    KP.KeywordIndex,
    pIdentifier,
    KP.KeywordOn,
    pDotDelimitedName,
    pColumnNames,
    A.makeIndex,
  ).thru(makeNode()).skip(r.IgnoredCreateIndexOptions),
  IgnoredCreateIndexOptions: (r) => P.alt(pIgnoredIndexOption, r.IncludeIndexOption, r.WhereIndexOption).many(),

  IncludeIndexOption: () => P.seq(KP.KeywordInclude, pColumnNames),

  WhereIndexOption: (r) => P.seq(KP.KeywordWhere, r.FilterPredicate),
  FilterPredicate: (r) => P.seq(r.Conjunct, P.seq(KP.LogicalOpAnd, r.Conjunct).fallback(null)),
  Conjunct: (r) => P.alt(r.Disjunct, r.Comparsion),
  Disjunct: () => P.seq(pIdentifier, KP.KeywordIn, makeList(pConst)),
  Comparsion: () => P.seq(pIdentifier, pComparsionOp, pConst),

});

module.exports = Lang.CreateIndex;
