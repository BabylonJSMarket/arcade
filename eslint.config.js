import bjsm from '@babylonjsmarket/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist', 'templates', 'coverage', 'node_modules'] },
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  ...bjsm.configs.recommended,
];
