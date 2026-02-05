import P from 'parsimmon';
import * as KP from '../../../keyword_parsers.js';
import {
  pIdentifier, pKeywordClusteredOrNon, pConst, pColumnNames, pDotDelimitedName, pComparsionOp,
} from '../../../base_parsers.js';
import { makeNode, makeList } from '../../../utils.js';
import * as A from './actions.js';
import { pIgnoredIndexOption } from '../../../index_definition/index.js';

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

export default Lang.CreateIndex;
