const P = require('parsimmon');
const KP = require('../keyword_parsers');
const { pDotDelimitedName, pIdentifier, pColumnNames } = require('../base_parsers');
const { makeList, makeNode } = require('../utils');
const A = require('./actions');

const Lang = P.createLanguage({
  TableConstraintFK: (r) => P.seqMap(
    KP.KeywordForeignKey.fallback(null),
    r.TableEndpoint,
    KP.KeywordReferences,
    pDotDelimitedName,
    r.TableEndpoint.fallback(null),
    r.FKOptions.fallback(null),
    A.makeTableConstraintFK,
  ),

  TableEndpoint: () => P.seqMap(
    pColumnNames,
    A.makeTableEndpoint,
  ).thru(makeNode()),

  ColumnConstraintFK: (r) => P.seqMap(
    r.FKKeywords,
    pDotDelimitedName,
    makeList(pIdentifier).fallback(null),
    r.FKOptions.fallback(null),
    A.makeColumnConstraintFK,
  ),
  FKOptions: (r) => P.alt(r.FKOnDelete, r.FKOnUpdate, r.FKNFR).many(),
  FKKeywords: () => P.seq(KP.KeywordForeignKey.fallback(null), KP.KeywordReferences),

  FKOnDelete: (r) => P.seqMap(
    KP.KeywordOnDelete,
    r.FKOnOptions,
    A.makeOnSetting,
  ),
  FKOnUpdate: (r) => P.seqMap(
    KP.KeywordOnUpdate,
    r.FKOnOptions,
    A.makeOnSetting,
  ),
  FKNFR: () => KP.KeywordNFR.map(value => {
    return { type: value };
  }),
  FKOnOptions: () => P.alt(KP.KeywordNoAction, KP.KeywordCascade, KP.KeywordSetDefault, KP.KeywordSetNull),


});
module.exports = {
  pColumnConstraintFK: Lang.ColumnConstraintFK,
  pTableConstraintFK: Lang.TableConstraintFK,
};
