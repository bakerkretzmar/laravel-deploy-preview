import { describe, expect, test, vi } from 'vitest';
import { normalizeDatabaseName, normalizeDomainName, until } from '../../src/lib';

describe('until', () => {
  test('run attempt callback once immediately', async () => {
    const attempt = vi.fn();

    expect(attempt).not.toHaveBeenCalled();

    await until(() => true, attempt);

    expect(attempt).toHaveBeenCalledTimes(1);
  });

  test('check condition once immediately after running attempt callback', async () => {
    const condition = vi.fn().mockImplementationOnce(() => true);

    expect(condition).not.toHaveBeenCalled();

    await until(condition, () => {});

    expect(condition).toHaveBeenCalledTimes(1);
  });

  test('re-run attempt callback every pause seconds until condition is true', async () => {
    const attempt = vi.fn();

    let conditionResult = false;
    // Pass the condition after 100ms
    setTimeout(() => (conditionResult = true), 100);

    // Check the condition every 40ms
    await until(() => conditionResult, attempt, 0.04);

    // Called immediately, after 40ms (false), after 80ms (false), after 120ms (true)
    expect(attempt).toHaveBeenCalledTimes(4);
  });

  test('return result', async () => {
    const attempt = vi.fn().mockImplementationOnce(() => 'result');

    expect(attempt).not.toHaveBeenCalled();

    const result = await until(() => true, attempt);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(result).toBe('result');
  });
});

describe('normalizeDatabaseName', () => {
  test.each([
    ['foo_bar', 'foo_bar'],
    ['foo-bar', 'foo_bar'],
    ['foo--bar', 'foo_bar'],
    ['--foo--bar--', 'foo_bar'],
    ['foo%-bar', 'foo_bar'],
    ['one! two? three 0x995', 'one_two_three_0x995'],
    ['jbk/px-454', 'jbk_px_454'],
    ["please+don't %20 do / this", 'please_don_t_20_do_this'],
  ])('%s → %s', (input, output) => {
    expect(normalizeDatabaseName(input)).toBe(output);
  });
});

describe('normalizeDomainName', () => {
  test.each([
    ['foo-bar', 'foo-bar'],
    ['-foo--bar--', 'foo-bar'],
    ['foo__bar', 'foo__bar'],
    ['foo%-bar', 'foo-bar'],
    ['one! two? three 0x995', 'one-two-three-0x995'],
    ['jbk/px-454', 'jbk-px-454'],
    ["please+don't %20 do / this", 'please-don-t-20-do-this'],
  ])('%s → %s', (input, output) => {
    expect(normalizeDomainName(input)).toBe(output);
  });
});
