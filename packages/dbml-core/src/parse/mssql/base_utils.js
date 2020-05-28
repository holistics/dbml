const P = require('parsimmon');
const wss = require('./whitespaces');

exports.word = function (string) {
  return P.string(string).skip(wss).desc(`"${string}"`);
};

function replaceWhitespaceWithRegexp (regexp) {
  let string = String(regexp);
  string = string.replace(/[\s]+/g, '[^\\S\\r]+');
  const lastSlash = string.lastIndexOf('/');
  return new RegExp(string.slice(1, lastSlash), string.slice(lastSlash + 1));
}
exports.keyword = function (regexp, multiword = false) {
  let newRegexp = regexp;
  const desc = regexp.source;
  if (multiword) {
    newRegexp = replaceWhitespaceWithRegexp(regexp);
  }
  return P.regexp(newRegexp).skip(wss).desc(`"${desc}"`);
};
