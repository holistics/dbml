const P = require('parsimmon');
const BP = require('../base_parsers');
const {
  pDotDelimitedName, pIdentifier, pNumberList, pOptionList,
} = require('../composite_parsers');
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
    BP.KeywordColumnSet,
  ),
  ComputedColumnDefinition: () => P.seq(
    pIdentifier,
    BP.KeywordAs,
    pExpression,
    P.seq(BP.KeywordPersisted, BP.KeywordNotNull.fallback(null)).fallback(null),
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
  DataTypeXML: () => P.seq(P.alt(BP.KeywordDocument, BP.KeywordContent), pIdentifier)
    .tieWith(' '),


  NullOrNot: () => P.alt(BP.KeywordNull.result(false), BP.KeywordNotNull.result(true))
    .thru(streamline('not_null')),

  Identity: () => BP.KeywordIdentity.result(true).skip(pNumberList.fallback(null))
    .thru(streamline('increment')),

  ColumnSetting1Word: () => P.alt(
    BP.KeywordFilestream,
    BP.KeywordNFR,
    BP.KeywordRowGUIDCol,
    BP.KeywordSparse,
  ),
  ColumnSettingWith: () => P.seq(P.alt(BP.KeywordMasked, BP.KeywordEncrypted), BP.KeywordWith, pOptionList),
  ColumnSettingCollate: () => P.seq(BP.KeywordCollate, pIdentifier),
  ColumnSettingGAAR: () => P.seq(
    BP.KeywordGeneratedAAR,
    P.alt(BP.KeywordStart, BP.KeywordEnd),
    BP.KeywordHidden.fallback(null),
  ),


});
module.exports = {
  pIdentity: Lang.Identity,
  pColumnIndex,
  pColumnConstraint,
  pDataType: Lang.DataType,
  pColumnsDefinition: Lang.ColumnsDefinition,
};
