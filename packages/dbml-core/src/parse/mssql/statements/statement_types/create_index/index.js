const P = require('parsimmon');
const KP = require('../../../keyword_parsers');
const {
  pIdentifier, pKeywordClusteredOrNon, pConst, pColumnNames, pDotDelimitedName, pComparsionOp,
} = require('../../../base_parsers');
const { makeNode, makeList } = require('../../../utils');
const A = require('./actions');
const { pIgnoredIndexOption } = require('../../../index_definition');

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
