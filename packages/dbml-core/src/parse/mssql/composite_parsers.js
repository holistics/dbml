const P = require('parsimmon');
const { makeList, streamline } = require('./utils');
const BP = require('./base_parsers');
const wss = require('./whitespaces');

const Lang = P.createLanguage({
  pIgnore: () => P.regex(/[^;]*/),
  pColumnNames: (r) => makeList(P.seq(r.pIdentifier, r.pKeywordAscOrDesc.fallback(null)).map(value => value[0])),

  pDotDelimitedName: (r) => P.sepBy1(r.pIdentifier, P.string('.')),

  pOptionList: (r) => makeList(r.pOption),
  pOption: (r) => P.seq(
    r.pIdentifier,
    BP.Equal,
    P.seq(
      P.alt(r.pIdentifier, r.pString).many(),
      P.alt(
        r.pOptionList,
        makeList(r.pIdentifier.many()),
      ).fallback(null),
    ),
  ),

  pComparsionOp: () => P.regex(/IS|IS[^\S\r\n]+NOT|=|<>|!=|>|>=|!>|<|<=|!</i).skip(wss),
  pConst: (r) => P.alt(r.pString, r.pUnicode, r.pBinary, r.pScience, r.pMoney, r.pSigned, r.pNumber),

  pMoney: (r) => P.seq(P.regexp(/[+-]\$/), r.pNumber).thru(streamline('money')),
  pSigned: (r) => P.seq(P.regexp(/[+-]/), r.pNumber).thru(streamline('signed')),
  pUnicode: (r) => P.seq(P.string('N'), r.pString).thru(streamline('unicode')),
  pString: () => P.regexp(/'[^']*'/).thru(streamline('string')).map(value => {
    const stringLiteral = value.value;
    value.value = stringLiteral.slice(1, stringLiteral.length - 1);
    return value;
  }),
  pNumberList: (r) => makeList(r.pNumber),
  pNumber: () => P.regexp(/[0-9]+(\.[0-9]+)?/).map(Number).thru(streamline('number')),
  pBinary: () => P.regexp(/0x[A-F0-9]*/).thru(streamline('binary')),
  pScience: () => P.regexp(/[+-]+[0-9]+(\.[0-9E]+)?/).thru(streamline('science')),

  pIdentifier: (r) => P.alt(r.pRegularIdentifier, r.pDelimitedIdentifier).skip(wss),
  pDelimitedIdentifier: (r) => P.alt(r.pDQDelimitedIdentifier, r.pBracketDelimitedIdentifier).skip(wss),

  pRegularIdentifier: () => P.regexp(/^[\w@#][\w@#$]*/).skip(wss),
  pDQDelimitedIdentifier: () => P.seq(
    P.string('"'),
    P.regexp(/[^"]*/),
    P.string('"'),
  ).map(value => value[1]).skip(wss),
  pBracketDelimitedIdentifier: () => P.seq(
    P.string('['),
    P.regexp(/[^\]]*/),
    P.string(']'),
  ).map(value => value[1]).skip(wss),

  pFunction: (r) => P.seq(r.pIdentifier, makeList(r.pFunctionParam, true))
    .map(value => `${value[0]}(${value[1].join(',')})`).thru(streamline('function')),
  pFunctionParam: (r) => P.alt(r.pNumber, r.pIdentifier),

  // SQL SERVER do not support boolean literal

  pKeywordPKOrUnique: () => P.alt(
    BP.KeywordPrimaryKey.result({ type: 'pk', value: true }),
    BP.KeywordUnique.result({ type: 'unique', value: true }),
  ),
  pKeywordClusteredOrNon: () => P.alt(BP.KeywordClustered, BP.KeywordNonclustered),
  pKeywordAscOrDesc: () => P.alt(BP.KeywordAsc, BP.KeywordDesc),
});

module.exports = Lang;
