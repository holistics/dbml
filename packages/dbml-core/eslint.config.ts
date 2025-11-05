import airbnbBase from 'eslint-config-airbnb-base';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: [
      'node_modules/*',
      'lib/*',
      'types/*',
    ],
  },
  {
    files: ['**/*.js'],
    rules: {
      ...airbnbBase.rules,
    }
  },
]);
