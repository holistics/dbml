const P = require('parsimmon');
const BP = require('../base_parsers');
const S = require('../statement_types');
const wss = require('../whitespaces');
const A = require('./actions');
const { pIgnore } = require('../composite_parsers');

const Lang = P.createLanguage({
  Statements: (r) => wss.then(r.Seperator)
    .then(P.sepBy(r.StatementTypes, r.Seperator))
    .skip(r.Seperator)
    .map(A.handleStatement),

  StatementTypes: (r) => P.alt(
    S.pCreateIndex,
    S.pCreateTable,
    S.pAlterTable,
    r.IgnoredStatementTypes,
  ),

  IgnoredStatementTypes: (r) => P.seq(r.IgnoredStatementSyntax, pIgnore),
  IgnoredStatementSyntax: (r) => P.alt(
    r.IgnoredDDLSyntax,
    r.IgnoredDMLSyntax,
    r.IgnoredBackupAndRestoreSyntax,
    r.IgnoredServiceBrokerSyntax,
    r.IgnoredPermissionSyntax,
    BP.KeywordAdd,
    BP.KeywordClose,
    BP.KeywordSet,
  ),

  IgnoredDDLSyntax: (r) => P.alt(
    r.KeywordCreateWithoutTable,
    r.KeywordAlterWithoutTable,
    BP.KeywordCollate,
    BP.KeywordDrop,
    BP.KeywordRename,
    BP.KeywordEnable,
    BP.KeywordDisable,
  ),

  IgnoredDMLSyntax: () => P.alt(
    BP.KeywordBulkInsert,
    BP.KeywordInsert,
    BP.KeywordUpdate,
    BP.KeywordMerge,
    BP.KeywordTruncateTable,
    BP.KeywordDelete,
  ),

  IgnoredServiceBrokerSyntax: () => P.alt(
    BP.KeywordBegin,
    BP.KeywordEnd,
    BP.KeywordMove,
    BP.KeywordReceive,
    BP.KeywordSend,
  ),

  IgnoredPermissionSyntax: () => P.alt(
    BP.KeywordDeny,
    BP.KeywordExecute,
    BP.KeywordGrant,
    BP.KeywordOpen,
    BP.KeywordRevoke,
  ),

  IgnoredBackupAndRestoreSyntax: () => P.alt(
    BP.KeywordBackup,
    BP.KeywordRestore,
  ),

  KeywordCreateWithoutTable: () => BP.KeywordCreate.notFollowedBy(BP.KeywordTable),
  KeywordAlterWithoutTable: () => BP.KeywordAlter.notFollowedBy(BP.KeywordTable),
  Seperator: () => P.alt(BP.Semicolon, BP.KeywordGo, P.seq(BP.Semicolon, BP.KeywordGo)).many(),
});

module.exports = Lang.Statements;
