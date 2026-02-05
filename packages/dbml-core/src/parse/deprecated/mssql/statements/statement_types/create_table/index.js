import P from 'parsimmon';
import * as KP from '../../../keyword_parsers.js';
import {
  pIdentifier, pDotDelimitedName,
} from '../../../base_parsers.js';
import { makeNode, makeList } from '../../../utils.js';
import { pTableConstraint } from '../../../constraint_definition/index.js';
import { pTableIndex, pIgnoredIndexOption } from '../../../index_definition/index.js';
import { pColumnsDefinition } from '../../../column_definition/index.js';
import * as A from './actions.js';

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

export default Lang.CreateTable;
