const mssqlParser = require('./statements/index.cjs');

mssqlParser.parseWithPegError = function (input) {
  try {
    return mssqlParser.tryParse(input);
  } catch (err) {
    const pegJSError = {
      name: 'SyntaxError',
    };
    console.error(err);
    pegJSError.location = {};
    pegJSError.location.start = err.result.index;
    pegJSError.found = input[pegJSError.location.start.offset];
    const lastExpected = err.result.expected.pop();
    const expectedString = `${err.result.expected.join(', ')}, or ${lastExpected}`;
    pegJSError.message = `Expected ${expectedString} but "${pegJSError.found}" found.`;

    throw (pegJSError);
  }
};

module.exports = mssqlParser;
