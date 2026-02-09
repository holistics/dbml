import P from 'parsimmon';
import * as KP from '../keyword_parsers.js';
import {
  pDotDelimitedName, pIdentifier, pNumberList, pOptionList,
} from '../base_parsers.js';
import { makeNode, makeList, streamline } from '../utils.js';
import { pColumnIndex } from '../index_definition/index.js';
import { pColumnConstraint } from '../constraint_definition/index.js';
import pExpression from '../expression.js';
import * as A from './actions.js';

const Lang = P.createLanguage({
  ColumnsDefinition: (r) => P.alt(
    r.ComputedColumnDefinition.result(null),
    r.ColumnSetDefinition.result(null),
    r.ColumnDefinition,
  ),

  ColumnDefinition: (r) => P.seqMap(
    pDotDelimitedName,
    r.DataType,
    P.alt(r.ColumnSetting, r.IgnoredColumnSetting.result(null)).many().fallback(null),
    A.makeColumn,
  ).thru(makeNode()),

  ColumnSetDefinition: () => P.seq(
    pIdentifier,
    KP.KeywordColumnSet,
  ),
  ComputedColumnDefinition: () => P.seq(
    pIdentifier,
    KP.KeywordAs,
    pExpression,
    P.seq(KP.KeywordPersisted, KP.KeywordNotNull.fallback(null)).fallback(null),
    pColumnConstraint.fallback(null),
  ),
  ColumnSetting: (r) => P.alt(
    r.NullOrNot,
    r.Identity,
    pColumnIndex,
    pColumnConstraint,
  ),

  IgnoredColumnSetting: (r) => P.alt(
    r.ColumnSetting1Word,
    r.ColumnSettingWith,
    r.ColumnSettingGAAR,
    r.ColumnSettingCollate,
  ),

  DataType: (r) => P.seqMap(
    pDotDelimitedName,
    makeList(P.alt(r.DataTypeXML, pIdentifier)).fallback(null),
    A.makeDataType,
  ),
  DataTypeXML: () => P.seq(P.alt(KP.KeywordDocument, KP.KeywordContent), pIdentifier)
    .tieWith(' '),

  NullOrNot: () => P.alt(KP.KeywordNull.result(false), KP.KeywordNotNull.result(true))
    .thru(streamline('not_null')),

  Identity: () => KP.KeywordIdentity.result(true).skip(pNumberList.fallback(null))
    .thru(streamline('increment')),

  ColumnSetting1Word: () => P.alt(
    KP.KeywordFilestream,
    KP.KeywordNFR,
    KP.KeywordRowGUIDCol,
    KP.KeywordSparse,
  ),
  ColumnSettingWith: () => P.seq(P.alt(KP.KeywordMasked, KP.KeywordEncrypted), KP.KeywordWith, pOptionList),
  ColumnSettingCollate: () => P.seq(KP.KeywordCollate, pIdentifier),
  ColumnSettingGAAR: () => P.seq(
    KP.KeywordGeneratedAAR,
    P.alt(KP.KeywordStart, KP.KeywordEnd),
    KP.KeywordHidden.fallback(null),
  ),

});

export const pIdentity = Lang.Identity;
export { pColumnIndex };
export { pColumnConstraint };
export const pDataType = Lang.DataType;
export const pColumnsDefinition = Lang.ColumnsDefinition;
