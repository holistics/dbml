import P from 'parsimmon';
import * as KP from '../keyword_parsers.js';
import { pDotDelimitedName, pIdentifier, pColumnNames } from '../base_parsers.js';
import { makeList, makeNode } from '../utils.js';
import * as A from './actions.js';

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
  FKNFR: () => KP.KeywordNFR.map((value) => {
    return { type: value };
  }),
  FKOnOptions: () => P.alt(KP.KeywordNoAction, KP.KeywordCascade, KP.KeywordSetDefault, KP.KeywordSetNull),

});

export const pColumnConstraintFK = Lang.ColumnConstraintFK;
export const pTableConstraintFK = Lang.TableConstraintFK;
