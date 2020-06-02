const P = require('parsimmon');
const _ = require('lodash');
const {
  pFunction, pDotDelimitedName, pConst,
} = require('./base_parsers');
const {
  LParen, RParen,
} = require('./keyword_parsers');
const wss = require('./whitespaces');
const { streamline } = require('./utils');

function tokenizeParen (parser) {
  return parser.many().map(value => value.join('')).fallback(null).thru(streamline('token'));
}
function enclose (parser) {
  const ManyRParen = RParen.thru(tokenizeParen);
  const ManyLParen = LParen.thru(tokenizeParen);
  return P.seq(ManyLParen, parser, ManyRParen);
}

function enclosedOrNot (parser) {
  return P.alt(enclose(parser), parser);
}
const Lang = P.createLanguage({
  ExpressionFinal: (r) => r.Expression.map(values => {
    const flattened = _.flattenDeep(values);
    return flattened.map(value => {
      return value ? value.value : '';
    }).join('');
  }),

  Expression: (r) => {
    return enclosedOrNot(
      P.seq(
        P.alt(r.UnaryExpression, r.SimpleExpression),
        r.BinaryExpressionLR.fallback(null),
      ).skip(wss),
    );
  },
  UnaryExpression: (r) => {
    const pUnaryOp = P.regex(/[+\-~]/).thru(streamline('unary_operator'));
    const pUnaryExp = P.seq(pUnaryOp, r.Expression).skip(wss);
    return enclosedOrNot(pUnaryExp);
  },
  BinaryExpressionLR: (r) => {
    const pBinaryOp = P.regexp(/[+\-*/%=!<>&^|]{1,2}/)
      .map(operator => ` ${operator} `)
      .thru(streamline('binary_operator')).skip(wss);
    const pBinaryExp = P.seq(pBinaryOp, r.Expression).skip(wss);
    return pBinaryExp;
  },
  SimpleExpression: (r) => {
    const pExp = P.alt(pFunction, pConst, r.ExpressionDDN).skip(wss);
    return enclosedOrNot(pExp);
  },
  ExpressionDDN: () => pDotDelimitedName.map(value => value.join('.')).thru(streamline('identifier')),
});

module.exports = Lang.ExpressionFinal;
