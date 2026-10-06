import { expect, test } from 'vitest';
import { isAxiosError } from '../src/universal/validation.ts';

test('recognizes transport errors with and without an HTTP response', () => {
  expect(isAxiosError({ name: 'AxiosError', message: 'Network error', isAxiosError: true })).toBe(true);
  expect(isAxiosError({ name: 'AxiosError', message: 'Unauthorized', isAxiosError: true, response: { status: 401 } })).toBe(true);
});

test('does not misclassify ordinary exceptions or malformed transport markers', () => {
  expect(isAxiosError(new Error('ordinary error'))).toBe(false);
  expect(isAxiosError({ isAxiosError: false, name: 'Error', message: 'bad marker' })).toBe(false);
  expect(isAxiosError({ isAxiosError: true })).toBe(false);
  expect(isAxiosError({ isAxiosError: true, name: 'AxiosError', message: 'bad status', response: { status: '401' } })).toBe(false);
});
