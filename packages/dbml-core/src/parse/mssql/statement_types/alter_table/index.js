const P = require('parsimmon');
const BP = require('../../base_parsers');
const {
  pDotDelimitedName, pIgnore,
} = require('../../composite_parsers');
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
  AlterTableKeywords: () => P.seq(BP.KeywordAlter, BP.KeywordTable),

  IgnoredAlterTableActions: (r) => P.seq(r.IgnoredAlterTableActionKeywords, pIgnore).result(null),
  IgnoredAlterTableActionKeywords: () => P.alt(
    BP.KeywordWith,
    BP.KeywordAlterColumn,
    BP.KeywordDrop,
    BP.KeywordEnable,
    BP.KeywordDisable,
    BP.KeywordCheck,
    BP.KeywordSwitch,
    BP.KeywordSet,
    BP.KeywordRebuild,
  ),
});
module.exports = Lang.AlterTable;
