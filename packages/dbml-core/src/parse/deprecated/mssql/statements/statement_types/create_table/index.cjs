const P = require('parsimmon');
const KP = require('../../../keyword_parsers.cjs');
const {
  pIdentifier, pDotDelimitedName,
} = require('../../../base_parsers.cjs');
const { makeNode, makeList } = require('../../../utils.cjs');
const { pTableConstraint } = require('../../../constraint_definition/index.cjs');
const { pTableIndex, pIgnoredIndexOption } = require('../../../index_definition/index.cjs');
const { pColumnsDefinition } = require('../../../column_definition/index.cjs');
const A = require('./actions.cjs');

const Lang = P.createLanguage({

  CreateTable: (r) => P.seqMap(
    r.CreateTableKeywords,
    pDotDelimitedName,
    r.AsFileTableKeywords.fallback(null),
    makeList(r.Line),
    A.makeTable,
  ).thru(makeNode()).skip(r.IgnoredTableOptions),

  CreateTableKeywords: () => P.seq(KP.KeywordCreate, KP.KeywordTable),
  AsFileTableKeywords: () => P.seq(KP.KeywordAs, KP.KeywordFileTable),
  Line: (r) => P.alt(
    r.SystemTimeTableOption,
    pTableConstraint,
    pTableIndex,
    pColumnsDefinition,
  ),
  SystemTimeTableOption: () => P.seq(KP.KeywordPeriodForST, makeList(pIdentifier)).result(null),
  IgnoredTableOptions: (r) => P.alt(pIgnoredIndexOption, r.TextImageTableOption).many(),
  TextImageTableOption: () => P.seq(KP.KeywordTextImage_On, pIdentifier),
});

module.exports = Lang.CreateTable;
