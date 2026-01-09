import pegjsRequire from 'pegjs-require-import';

const { sourceCode } = pegjsRequire('./parser.pegjs', {
  format: 'commonjs',
  dependencies: {
    _: 'lodash',
  },
});

console.log(sourceCode);
