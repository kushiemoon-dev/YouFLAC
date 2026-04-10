/**
 * runWithConcurrency runs `tasks` with at most `limit` concurrent workers.
 * Returns results in the same order as `tasks`.
 *
 * NOTE: If any task rejects, the returned promise rejects immediately but
 * already-started workers continue until they complete. Tasks should handle
 * their own errors and never reject — use try/catch internally and return
 * a sentinel value instead of throwing.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) break;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
