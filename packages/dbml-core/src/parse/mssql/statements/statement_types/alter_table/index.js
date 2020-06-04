const P = require('parsimmon');
const KP = require('../../../keyword_parsers');
const {
  pDotDelimitedName, pIgnore,
} = require('../../../base_parsers');
const A = require('./actions');
const pAddAction = require('./add');

const Lang = P.createLanguage({

  AlterTable: (r) => P.seqMap(
    r.AlterTableKeywords,
    pDotDelimitedName,
    r.AlterTableActions,
    A.handleAlterTableResult,
  ),
  AlterTableActions: (r) => P.alt(pAddAction, r.IgnoredAlterTableActions),
  AlterTableKeywords: () => P.seq(KP.KeywordAlter, KP.KeywordTable),

  IgnoredAlterTableActions: (r) => P.seq(r.IgnoredAlterTableActionKeywords, pIgnore).result(null),
  IgnoredAlterTableActionKeywords: () => P.alt(
    KP.KeywordWith,
    KP.KeywordAlterColumn,
    KP.KeywordDrop,
    KP.KeywordEnable,
    KP.KeywordDisable,
    KP.KeywordCheck,
    KP.KeywordSwitch,
    KP.KeywordSet,
    KP.KeywordRebuild,
  ),
});
module.exports = Lang.AlterTable;
