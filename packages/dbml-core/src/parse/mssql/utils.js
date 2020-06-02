const P = require('parsimmon');
const {
  LParen, RParen, Comma,
} = require('./keyword_parsers');

const wss = require('./whitespaces');

exports.makeNode = function () {
  return function (parser) {
    return P.seqMap(P.index, parser, P.index, (start, value, end) => {
      if (!value) return parser;
      if (typeof value.value !== 'object') value.value = { value: value.value };
      value.value.token = {
        start,
        end,
      };
      return value;
    }).skip(wss);
  };
};

exports.makeList = function (parser, isZero = false) {
  let seperator = parser.sepBy1(Comma);
  if (isZero) seperator = parser.sepBy(Comma);
  return P.seq(LParen, seperator, RParen).map(value => {
    return value[1];
  });
};

exports.streamline = function (type) {
  return function (parser) {
    return parser.skip(wss).map(value => {
      // eslint-disable-next-line no-param-reassign
      if (!value) value = '';
      return {
        type,
        value,
      };
    });
  };
};
