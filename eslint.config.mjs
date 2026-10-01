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
      // Skipping because the environment lacks something (for example the local practice API) is fine.
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expect', 'expectVersionFooter'] }],
    },
  },

  // Practice API and runner for k6 (Node, CommonJS)
  {
    files: ['perf/server/**/*.js', 'perf/run.js'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },

  // k6 scripts (TypeScript, run by k6, not by Node)
  {
    files: ['perf/k6/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },

  // Site code (plain browser scripts, loaded with <script defer>; PW and Shop are shared globals)
  {
    files: ['assets/js/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, PW: 'readonly', Shop: 'readonly', PerfApi: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
);
