import P from 'parsimmon';
import wss from './whitespaces.js';

export function word(string) {
  return P.string(string).skip(wss).desc(`"${string}"`);
}

function replaceWhitespaceWithRegexp(regexp) {
  let string = String(regexp);
  string = string.replace(/[\s]+/g, '\\s+');
  const lastSlash = string.lastIndexOf('/');
  return new RegExp(string.slice(1, lastSlash), string.slice(lastSlash + 1));
}

export function keyword(regexp) {
  let newRegexp = regexp;
  const desc = regexp.source;
  newRegexp = replaceWhitespaceWithRegexp(regexp);
  return P.regexp(newRegexp).skip(wss).desc(`"${desc}"`);
}
