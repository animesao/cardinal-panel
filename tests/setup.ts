// Общие заглушки для юнит-тестов: Nuxt auto-import'ы недоступны вне
// приложения, поэтому объявляем их явно.
import { vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var createError: (input: {
    statusCode?: number;
    statusMessage?: string;
    message?: string;
    data?: unknown;
  }) => Error;
}

globalThis.createError = ((input: {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
}) => {
  const error = new Error(input.statusMessage || input.message || 'error');
  (error as Error & { statusCode?: number }).statusCode = input.statusCode ?? 500;
  return error;
}) as typeof globalThis.createError;

export { vi };
