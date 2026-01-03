// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config({
  // Files to lint: only your source files
  files: ['**/*.ts', '**/*.tsx'],
  // Files to ignore: node_modules, build, and crucially, dist/
  ignores: ['node_modules/', 'dist/', 'build/'],

  extends: [
    eslint.configs.recommended, // ESLint's recommended rules
    ...tseslint.configs.recommended, // TypeScript-ESLint's recommended rules
    prettierConfig, // Disables ESLint rules that conflict with Prettier
  ],

  plugins: {
    prettier: prettierPlugin, // Integrates Prettier as an ESLint plugin
  },
  rules: {
    // Prettier Integration
    'prettier/prettier': 'error', // Report Prettier issues as ESLint errors

    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_', // Ignore arguments starting with an underscore
        varsIgnorePattern: '^_', // Ignore variables starting with an underscore
        caughtErrorsIgnorePattern: '^_', // Specifically ignore caught errors starting with an underscore
      },
    ],

    '@typescript-eslint/no-explicit-any': 'off',
  },
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.eslint.json', // ESLint-specific TSConfig for type-aware linting
      // Using 'latest' or 'es2022' (or higher) is good for modern JS features
      ecmaVersion: 'latest',
      // Set sourceType to 'module' for import/export syntax in your source files
      sourceType: 'module',
    },
  },
});
