const P = require('parsimmon');
const wss = require('./whitespaces');

exports.word = function (string) {
  return P.string(string).skip(wss).desc(`"${string}"`);
};

exports.keyword = function (regexp, multiword = false) {
  let newRegexp = regexp;
  const desc = regexp.source;
  if (multiword) {
    let string = String(regexp);
    string = string.replace(/[\s]+/g, '[^\\S\\r]+');
    const lastSlash = string.lastIndexOf('/');
    newRegexp = new RegExp(string.slice(1, lastSlash), string.slice(lastSlash + 1));
  }
  return P.regexp(newRegexp).skip(wss).desc(`"${desc}"`);
};
