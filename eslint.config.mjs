import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', '_site/'] },

  // Playwright specs (TypeScript)
  {
    files: ['tests/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, playwright.configs['flat/recommended']],
    languageOptions: {
      globals: globals.node,
      // Type information is needed for no-floating-promises.
      parserOptions: { project: './tests/tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Un-awaited Playwright actions (click, goto, fill, ...) are a classic source of flaky tests.
      '@typescript-eslint/no-floating-promises': 'error',
      // Helpers that contain the assertions for a test.
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expect', 'expectVersionFooter'] }],
    },
  },

  // Site code (plain browser scripts, loaded with <script defer>; PW and Shop are shared globals)
  {
    files: ['assets/js/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, PW: 'readonly', Shop: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
);
