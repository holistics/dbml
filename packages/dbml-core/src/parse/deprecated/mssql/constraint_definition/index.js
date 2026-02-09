import P from 'parsimmon';
import * as KP from '../keyword_parsers.js';
import pExpression from '../expression.js';
import {
  pIdentifier, pConst, pFunction,
} from '../base_parsers.js';
import { makeList, streamline, makeNode } from '../utils.js';
import { pColumnConstraintFK, pTableConstraintFK } from '../fk_definition/index.js';
import { pColumnConstraintIndex, pTableConstraintIndex } from '../index_definition/index.js';
import * as A from './actions.js';

const Lang = P.createLanguage({
  TableConstraint: (r) => P.seqMap(
    r.ConstraintName.fallback(null),
    r.TableConstraintOption,
    A.makeTableConstraint,
  ).thru(makeNode()),

  TableConstraintOption: (r) => P.alt(
    pTableConstraintFK,
    pTableConstraintIndex,
    r.ConstraintCheck,
  ),
  ColumnConstraint: (r) => P.seq(r.ConstraintName.fallback(null), r.ColumnConstraintOption)
    .map((value) => value[1]),

  ColumnConstraintOption: (r) => P.alt(
    pColumnConstraintIndex,
    pColumnConstraintFK,
    r.ConstraintCheck,
    r.ConstraintDefault,
  ),

  ConstraintCheck: (r) => P.seq(
    KP.KeywordCheck,
    KP.KeywordNFR.fallback(null),
    r.ConstraintCheckExpr,
  ).map((value) => value[2]),

  ConstraintCheckExpr: (r) => P.alt(
    P.seq(
      KP.LParen.fallback(null),
      r.ConstraintCheckEnum,
      KP.RParen.fallback(null),
    ).map((value) => value[1]),
    pExpression.thru(streamline('expression')),
  ),

  ConstraintCheckEnum: () => P.seqMap(
    pIdentifier,
    KP.LogicalOpIn,
    makeList(pConst.thru(makeNode())),
    A.makeConstraintCheckEnum,
  ).thru(makeNode()),

  ConstraintDefault: (r) => P.seqMap(
    KP.KeywordDefault,
    r.ConstExpr,
    A.makeDefaultConstraint,
  ),

  ConstExpr: (r) => P.alt(
    P.seq(
      KP.LParen,
      r.ConstExpr,
      KP.RParen,
    ).map((value) => value[1]),
    pFunction,
    pConst,
    KP.KeywordNull.thru(streamline('boolean')),
  ),
  ConstraintName: () => P.seq(KP.KeywordConstraint, pIdentifier).map((value) => value[1]),
});

export const pColumnConstraint = Lang.ColumnConstraint;
export const pTableConstraint = Lang.TableConstraint;
export const pConstraintCheck = Lang.ConstraintCheck;
export const pConstraintName = Lang.ConstraintName;
export const pConstExpr = Lang.ConstExpr;
export { makeTableConstraint } from './actions.js';
