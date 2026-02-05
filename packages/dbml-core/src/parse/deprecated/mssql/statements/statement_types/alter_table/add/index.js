import P from 'parsimmon';
import * as KP from '../../../../keyword_parsers.js';
import { pIdentifier } from '../../../../base_parsers.js';
import { makeNode, makeList } from '../../../../utils.js';
import * as A from './actions.js';
import { pTableConstraintFK } from '../../../../fk_definition/index.js';
import { pTableConstraintIndex } from '../../../../index_definition/index.js';
import { pConstraintCheck, pConstExpr, pConstraintName } from '../../../../constraint_definition/index.js';
import { pColumnsDefinition } from '../../../../column_definition/index.js';

const Lang = P.createLanguage({
  AddAction: (r) => P.seq(KP.KeywordAdd, r.AddOption.sepBy1(KP.Comma)).map((value) => value[1]),
  AddOption: (r) => P.alt(r.AddConstraint, pColumnsDefinition.result(null), r.IgnoredAddSystemTimeOption.result(null)),

  IgnoredAddSystemTimeOption: () => P.alt(pIdentifier, P.regexp(/[(),]/)).many(),
  AddConstraint: (r) => P.seqMap(
    pConstraintName.fallback(null),
    r.AddConstraintOption,
    A.makeTableConstraint,
  ).thru(makeNode()),
  AddConstraintOption: (r) => P.alt(
    pTableConstraintFK,
    pTableConstraintIndex,
    pConstraintCheck,
    r.AddConstraintDefault,
    r.IgnoredAddConstraintOption.result(null),
  ),

  IgnoredAddConstraintOption: (r) => P.alt(
    r.AddConstraintConnection,
  ),

  AddConstraintDefault: () => P.seqMap(
    KP.KeywordDefault,
    pConstExpr,
    KP.KeywordFor,
    pIdentifier,
    KP.KeywordWithValues.fallback(null),
    A.makeDefault,
  ),

  AddConstraintConnection: () => P.seq(
    KP.KeywordConnection,
    makeList(P.seq(pIdentifier, KP.KeywordTo, pIdentifier)),
  ),
});

export default Lang.AddAction;
