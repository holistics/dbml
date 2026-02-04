const P = require('parsimmon');
const KP = require('../keyword_parsers.cjs');
const {
  pIdentifier, pKeywordClusteredOrNon, pFunction, pOptionList, pColumnNames, pKeywordPKOrUnique, pOption,
} = require('../base_parsers.cjs');
const { makeNode } = require('../utils.cjs');
const A = require('./actions.cjs');

const Lang = P.createLanguage({

  TableIndex: (r) => P.seqMap(
    KP.KeywordIndex,
    pIdentifier,
    KP.KeywordUnique.fallback(null),
    pKeywordClusteredOrNon.fallback(null),
    KP.KeywordColumnStore.fallback(null),
    pColumnNames,
    A.makeTableIndex,
  ).thru(makeNode()).skip(r.IgnoredIndexOptions),

  TableConstraintIndex: (r) => P.seqMap(
    pKeywordPKOrUnique,
    pKeywordClusteredOrNon.fallback(null),
    pColumnNames,
    A.makeTableConstraintIndex,
  ).thru(makeNode()).skip(r.IgnoredIndexOptions),

  ColumnConstraintIndex: (r) => P.seq(
    pKeywordPKOrUnique,
  ).skip(r.IgnoredIndexOptions).map((value) => value[0]),

  ColumnIndex: (r) => P.seqMap(
    KP.KeywordIndex,
    pIdentifier,
    A.makeColumnIndex,
  ).thru(makeNode()).skip(r.IgnoredIndexOptions),

  IgnoredIndexOptions: (r) => P.alt(pKeywordClusteredOrNon, r.IgnoredIndexOption).many(),
  IgnoredIndexOption: (r) => P.alt(
    r.WithIndexOption,
    r.ColumnIndexFilestream,
    r.OnIndexOption,
    r.WithFillFactorOption,
  ),
  WithIndexOption: () => P.seq(KP.KeywordWith, pOptionList),
  WithFillFactorOption: () => P.seq(KP.KeywordWith, pOption),
  OnIndexOption: () => P.seq(KP.KeywordOn, P.alt(pIdentifier, pFunction)),
  ColumnIndexFilestream: () => P.seq(KP.KeywordFilestream_On, pIdentifier),
});
module.exports = {
  pColumnIndex: Lang.ColumnIndex,
  pIgnoredIndexOption: Lang.IgnoredIndexOption,
  pTableIndex: Lang.TableIndex,
  pColumnConstraintIndex: Lang.ColumnConstraintIndex,
  pTableConstraintIndex: Lang.TableConstraintIndex,
};
