const P = require('parsimmon');
const KP = require('../../../keyword_parsers');
const {
  pIdentifier, pDotDelimitedName,
} = require('../../../composite_parsers');
const { makeNode, makeList } = require('../../../utils');
const { pTableConstraint } = require('../../../constraint_definition');
const { pTableIndex, pIgnoredIndexOption } = require('../../../index_definition');
const { pColumnsDefinition } = require('../../../column_definition');
const A = require('./actions');

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
