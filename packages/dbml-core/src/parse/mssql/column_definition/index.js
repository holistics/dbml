const P = require('parsimmon');
const KP = require('../keyword_parsers');
const {
  pDotDelimitedName, pIdentifier, pNumberList, pOptionList,
} = require('../base_parsers');
const { makeNode, makeList, streamline } = require('../utils');
const { pColumnIndex } = require('../index_definition');
const { pColumnConstraint } = require('../constraint_definition');
const pExpression = require('../expression');
const A = require('./actions');


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
module.exports = {
  pIdentity: Lang.Identity,
  pColumnIndex,
  pColumnConstraint,
  pDataType: Lang.DataType,
  pColumnsDefinition: Lang.ColumnsDefinition,
};
