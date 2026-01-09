const P = require('parsimmon');
const KP = require('../keyword_parsers');
const S = require('./statement_types');
const wss = require('../whitespaces');
const A = require('./actions');
const { pIgnore } = require('../base_parsers');

const Lang = P.createLanguage({
  Statements: (r) => wss.then(r.Seperator)
    .then(P.sepBy(r.StatementTypes, r.Seperator))
    .skip(r.Seperator)
    .map(A.handleStatement),

  StatementTypes: (r) => P.alt(
    S.pCreateIndex,
    S.pCreateTable,
    S.pAlterTable,
    S.pCommentSyntax,
    r.IgnoredStatementTypes,
  ),

  IgnoredStatementTypes: (r) => P.seq(r.IgnoredStatementSyntax, pIgnore),
  IgnoredStatementSyntax: (r) => P.alt(
    r.IgnoredDDLSyntax,
    r.IgnoredDMLSyntax,
    r.IgnoredBackupAndRestoreSyntax,
    r.IgnoredServiceBrokerSyntax,
    r.IgnoredPermissionSyntax,
    KP.KeywordAdd,
    KP.KeywordClose,
    KP.KeywordSet,
    KP.KeywordIf,
  ),

  IgnoredDDLSyntax: (r) => P.alt(
    r.KeywordCreateWithoutTable,
    r.KeywordAlterWithoutTable,
    KP.KeywordCollate,
    KP.KeywordDrop,
    KP.KeywordRename,
    KP.KeywordEnable,
    KP.KeywordDisable,
  ),

  IgnoredDMLSyntax: () => P.alt(
    KP.KeywordBulkInsert,
    KP.KeywordInsert,
    KP.KeywordUpdate,
    KP.KeywordMerge,
    KP.KeywordTruncateTable,
    KP.KeywordDelete,
  ),

  IgnoredServiceBrokerSyntax: () => P.alt(
    KP.KeywordBegin,
    KP.KeywordEnd,
    KP.KeywordMove,
    KP.KeywordReceive,
    KP.KeywordSend,
  ),

  IgnoredPermissionSyntax: () => P.alt(
    KP.KeywordDeny,
    KP.KeywordExecute,
    KP.KeywordGrant,
    KP.KeywordOpen,
    KP.KeywordRevoke,
  ),

  IgnoredBackupAndRestoreSyntax: () => P.alt(
    KP.KeywordBackup,
    KP.KeywordRestore,
  ),

  KeywordCreateWithoutTable: () => KP.KeywordCreate.notFollowedBy(KP.KeywordTable),
  KeywordAlterWithoutTable: () => KP.KeywordAlter.notFollowedBy(KP.KeywordTable),
  Seperator: () => P.alt(KP.Semicolon, KP.KeywordGo, P.seq(KP.Semicolon, KP.KeywordGo)).many(),
});

module.exports = Lang.Statements;
