const P = require('parsimmon');
const { makeList, streamline } = require('./utils');
const KP = require('./keyword_parsers');
const wss = require('./whitespaces');

const pIgnore = P((input, i) => {
  let j = i;
  let isEnclosed = false;
  let encloseChar = '';
  while (j < input.length && (isEnclosed || !input.slice(j, j + 2).match(/GO|;/i))) {
    if (isEnclosed && input[j].match(/\]|'|"/i) && input[j] === encloseChar) {
      isEnclosed = false;
    } else if (!isEnclosed && input[j].match(/\[|"|'/i)) {
      isEnclosed = true;
      encloseChar = input[j];
      if (input[j] === '[') encloseChar = ']';
    }
    if (!input[j].match(/\s/)) j += 1;
    while (j < input.length && input[j].match(/\s/)) {
      j += 1;
    }
  }
  if (input.slice(j, j + 2).match(/GO/i)) j -= 1;
  return P.makeSuccess(j + 1, '');
});

const Lang = P.createLanguage({
  pIgnore: () => pIgnore,
  pColumnNames: (r) => makeList(P.seq(r.pIdentifier, r.pKeywordAscOrDesc.fallback(null)).map(value => value[0])).desc('list of column names'),

  pDotDelimitedName: (r) => P.sepBy1(r.pIdentifier, P.string('.')).desc('dot delimited identifier'),

  pOptionList: (r) => makeList(r.pOption),
  pOption: (r) => P.seq(
    r.pIdentifier,
    KP.Equal,
    P.seq(
      P.alt(r.pIdentifier, r.pString).many(),
      P.alt(
        r.pOptionList,
        makeList(r.pIdentifier.many()),
      ).fallback(null),
    ),
  ).desc('option'),

  pComparsionOp: () => P.regex(/IS|IS[^\S\r\n]+NOT|=|<>|!=|>|>=|!>|<|<=|!</i).skip(wss).desc('comparsion operator'),
  // SQL SERVER do not support boolean literal
  pConst: (r) => P.alt(r.pString, r.pUnicode, r.pBinary, r.pScience, r.pMoney, r.pSigned, r.pNumber).desc('constant'),

  pFunction: (r) => P.seq(r.pIdentifier, makeList(r.pFunctionParam, true))
    .map(value => `${value[0]}(${value[1].join(',')})`).thru(streamline('function')).desc('function constant'),
  pFunctionParam: (r) => P.alt(r.pNumber, r.pIdentifier).desc('identifier or number paremeter'),

  pMoney: (r) => P.seq(P.regexp(/[+-]\$/), r.pNumber).thru(streamline('money')).desc('money constant'),
  pSigned: (r) => P.seq(P.regexp(/[+-]/), r.pNumber).thru(streamline('signed')).desc('signed constant'),
  pUnicode: (r) => P.seq(P.string('N'), r.pString).thru(streamline('unicode')).desc('unicode constant'),
  pString: () => P.regexp(/'[^']*'/).thru(streamline('string')).map(value => {
    const stringLiteral = value.value;
    value.value = stringLiteral.slice(1, stringLiteral.length - 1);
    return value;
  }).desc('string constant'),
  pNumberList: (r) => makeList(r.pNumber).desc('list of number'),
  pNumber: () => P.regexp(/[0-9]+(\.[0-9]+)?/).map(Number).thru(streamline('number')).desc('number constant'),
  pBinary: () => P.regexp(/0x[A-F0-9]*/).thru(streamline('binary')).desc('binary constant'),
  pScience: () => P.regexp(/[+-]+[0-9]+(\.[0-9E]+)?/).thru(streamline('science')).desc('science constant'),

  pIdentifier: (r) => P.alt(r.pRegularIdentifier, r.pDelimitedIdentifier).skip(wss).desc('identifier'),
  pDelimitedIdentifier: (r) => P.alt(r.pDQDelimitedIdentifier, r.pBracketDelimitedIdentifier).skip(wss).desc('delimited identifier'),

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


  pKeywordPKOrUnique: () => P.alt(
    KP.KeywordPrimaryKey.result({ type: 'pk', value: true }),
    KP.KeywordUnique.result({ type: 'unique', value: true }),
  ),
  pKeywordClusteredOrNon: () => P.alt(KP.KeywordClustered, KP.KeywordNonclustered),
  pKeywordAscOrDesc: () => P.alt(KP.KeywordAsc, KP.KeywordDesc),
});

module.exports = Lang;
