import js from '@eslint/js';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'main.js',
      'coverage/',
      'dist/',
      'specs/',
      '.specify/',
      '.agents/',
      '.opencode/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { obsidianmd },
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
      globals: { createEl: 'readonly', createDiv: 'readonly', createSpan: 'readonly' },
    },
    rules: {
      'obsidianmd/detach-leaves': 'error',
      'obsidianmd/no-unsupported-api': 'error',
      'obsidianmd/no-static-styles-assignment': 'error',
      'obsidianmd/no-view-references-in-plugin': 'error',
      'obsidianmd/no-plugin-as-component': 'error',
      'obsidianmd/settings-tab/no-deprecated-display': 'error',
      'obsidianmd/no-global-this': 'warn',
      'obsidianmd/prefer-create-el': 'warn',
      'obsidianmd/prefer-instanceof': 'warn',
      'obsidianmd/settings-tab/prefer-setting-definitions': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
    },
  },
);
