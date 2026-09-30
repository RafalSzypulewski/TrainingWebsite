/**
 * Types for the page-side `PW` library (assets/js/core/pw.js), for tests that call it through
 * page.evaluate(). Only the members the tests use are declared.
 */
declare const PW: {
  esc(value: string): string;
  isEmail(value: string): boolean;
  show(el: HTMLElement, message: string): void;
  fieldError(id: string, message: string): string;
  errorSummary(el: HTMLElement, count: number, action: string): void;
  setBusy(busy: boolean, button?: HTMLElement | null, spinner?: HTMLElement | null): void;
  toast(message: string, options?: { kind?: 'success' | 'error'; dismissible?: boolean; duration?: number }): void;
  storage: {
    getJSON(key: string, fallback: unknown): unknown;
    setJSON(key: string, value: unknown): void;
  };
  cookie: {
    names(): string[];
    get(name: string): string | null;
    set(name: string, value: string, options?: { maxAge?: number }): void;
    remove(name: string): void;
  };
  session: {
    get(): { username: string; role: string } | null;
    set(user: { username: string; role: string }, remember: boolean): void;
    clear(): void;
  };
};
