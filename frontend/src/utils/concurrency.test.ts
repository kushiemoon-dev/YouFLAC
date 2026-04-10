import { describe, it, expect } from 'vitest';
import { runWithConcurrency } from './concurrency';

describe('runWithConcurrency', () => {
  it('returns empty array for empty tasks', async () => {
    const result = await runWithConcurrency([], 3);
    expect(result).toEqual([]);
  });

  it('runs all tasks when limit exceeds task count', async () => {
    const tasks = [1, 2, 3].map((n) => () => Promise.resolve(n));
    const results = await runWithConcurrency(tasks, 10);
    expect(results).toEqual([1, 2, 3]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((r) => setTimeout(r, 10));
      active--;
      return i;
    });

    await runWithConcurrency(tasks, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('returns results in original order even if later tasks finish first', async () => {
    // Task 0 takes longer than task 1
    const tasks = [
      () => new Promise<number>((r) => setTimeout(() => r(0), 50)),
      () => Promise.resolve(1),
      () => Promise.resolve(2),
    ];
    const results = await runWithConcurrency(tasks, 3);
    expect(results).toEqual([0, 1, 2]);
  });

  it('propagates rejection from any task', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(3),
    ];
    await expect(runWithConcurrency(tasks, 3)).rejects.toThrow('boom');
  });
});
