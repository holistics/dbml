import P from 'parsimmon';
import * as KP from '../keyword_parsers.js';
import {
  pIdentifier, pKeywordClusteredOrNon, pFunction, pOptionList, pColumnNames, pKeywordPKOrUnique, pOption,
} from '../base_parsers.js';
import { makeNode } from '../utils.js';
import * as A from './actions.js';

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

export const pColumnIndex = Lang.ColumnIndex;
export const pIgnoredIndexOption = Lang.IgnoredIndexOption;
export const pTableIndex = Lang.TableIndex;
export const pColumnConstraintIndex = Lang.ColumnConstraintIndex;
export const pTableConstraintIndex = Lang.TableConstraintIndex;
