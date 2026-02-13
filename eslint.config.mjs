import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginNode from 'eslint-plugin-node';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintPluginSecurity from 'eslint-plugin-security';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default [
  {
    ignores: ['dist', 'node_modules', 'prisma'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      node: eslintPluginNode,
      '@typescript-eslint': typescriptEslintPlugin,
      prettier: eslintPluginPrettier,
      import: eslintPluginImport,
      'simple-import-sort': eslintPluginSimpleImportSort,
      unicorn: eslintPluginUnicorn,
      security: eslintPluginSecurity,
    },
    rules: {
      'prettier/prettier': 'off',
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'node/no-process-env': 'off',
      'security/detect-object-injection': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-array-reduce': 'off',
      'import/extensions': 'off',
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: ['README.md'],
        },
      ],
    },
  },
  eslintConfigPrettier,
];
