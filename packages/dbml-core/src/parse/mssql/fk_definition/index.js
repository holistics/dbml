const P = require('parsimmon');
const BP = require('../base_parsers');
const { pDotDelimitedName, pIdentifier, pColumnNames } = require('../composite_parsers');
const { makeList, makeNode } = require('../utils');
const A = require('./actions');

const Lang = P.createLanguage({
  TableConstraintFK: (r) => P.seqMap(
    BP.KeywordForeignKey.fallback(null),
    r.TableEndpoint,
    BP.KeywordReferences,
    pDotDelimitedName,
    r.TableEndpoint,
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
  FKKeywords: () => P.seq(BP.KeywordForeignKey.fallback(null), BP.KeywordReferences),

  FKOnDelete: (r) => P.seqMap(
    BP.KeywordOnDelete,
    r.FKOnOptions,
    A.makeOnSetting,
  ),
  FKOnUpdate: (r) => P.seqMap(
    BP.KeywordOnUpdate,
    r.FKOnOptions,
    A.makeOnSetting,
  ),
  FKNFR: () => BP.KeywordNFR.map(value => {
    return { type: value };
  }),
  FKOnOptions: () => P.alt(BP.KeywordNoAction, BP.KeywordCascade, BP.KeywordSetDefault, BP.KeywordSetNull),


});
module.exports = {
  pColumnConstraintFK: Lang.ColumnConstraintFK,
  pTableConstraintFK: Lang.TableConstraintFK,
};
