import { test as base, expect } from '@playwright/test';

/**
 * Every spec imports `test` and `expect` from here instead of '@playwright/test'.
 *
 * The extra `consoleGuard` fixture runs automatically and fails a test when any page in its
 * browser context logs a console error or throws an uncaught exception. That turns silent
 * JavaScript bugs (a missing element id, a handler attached too late, ...) into test failures.
 *
 * Tests that deliberately provoke errors, for example by mocking a 500 or aborting a request
 * (the browser logs "Failed to load resource" for those), allow them explicitly and narrowly:
 *
 *   test.use({ allowedConsoleErrors: [/Failed to load resource.*users\.json/] });
 */
type Options = {
  /** Patterns tested against "<message> (<url of the failing resource>)"; matching errors are ignored. */
  allowedConsoleErrors: RegExp[];
};

export const test = base.extend<Options & { consoleGuard: void }>({
  allowedConsoleErrors: [[], { option: true }],

  consoleGuard: [
    async ({ context, allowedConsoleErrors }, use) => {
      const problems: string[] = [];

      context.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = `${message.text()} (${message.location().url})`;
        if (allowedConsoleErrors.some((pattern) => pattern.test(text))) return;
        problems.push(`console.error: ${text}`);
      });
      context.on('weberror', (webError) => {
        problems.push(`uncaught exception: ${webError.error().message}`);
      });

      await use();

      expect(problems, 'unexpected browser errors (allow them with test.use({ allowedConsoleErrors }))').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
