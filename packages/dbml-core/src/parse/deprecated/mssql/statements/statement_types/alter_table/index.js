import P from 'parsimmon';
import * as KP from '../../../keyword_parsers.js';
import {
  pDotDelimitedName, pIgnore,
} from '../../../base_parsers.js';
import * as A from './actions.js';
import pAddAction from './add/index.js';

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

export default Lang.AlterTable;
