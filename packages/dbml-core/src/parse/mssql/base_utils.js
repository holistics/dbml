const P = require('parsimmon');
const wss = require('./whitespaces');

const keywords = [];
exports.word = function (string) {
  return P.string(string).skip(wss);
};

exports.keyword = function (regex, op = false) {
  if (!op) keywords.push(regex);
  return P.regexp(regex).skip(wss);
};

exports.keywords = keywords;
