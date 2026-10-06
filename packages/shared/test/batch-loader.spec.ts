import { describe, expect, test } from 'vitest';
import { BatchCache, BatchLoader, type BatchRequest, type BatchResult, type BatchState } from '../src/universal/batch-loader.ts';

interface Item { id: string }

const batch = (start: number, count: number): Item[] => Array.from({ length: count }, (_, i) => ({ id: String(start + i) }));

/** Creates observable loader state with an injectable request implementation. */
function fixture(fetch: (request: BatchRequest) => Promise<BatchResult<Item>>, cache?: BatchCache<BatchResult<Item>>) {
  let state: BatchState<Item>;
  const loader = new BatchLoader(fetch, item => item.id, (next) => {
    state = next;
  }, cache);

  loader.reset('server-a/user-a', 'release-desc');

  return { loader, state: () => state };
}

describe('endless library batches', () => {
  test('loads exactly one bounded batch and retains cards as more are requested', async () => {
    const calls: BatchRequest[] = [];
    const f = fixture((request) => {
      calls.push(request);

      return Promise.resolve({ items: batch(request.startIndex, 50), total: 10_000 });
    });

    await f.loader.next();
    expect(calls.map(({ startIndex, limit }) => [startIndex, limit])).toEqual([[0, 50]]);
    expect(f.state().items).toHaveLength(50);
    await f.loader.next();
    expect(f.state().items).toHaveLength(100);
    expect(calls[1]?.startIndex).toBe(50);
    expect(f.state().items[0]?.id).toBe('0');
  });

  test('coalesces overlapping next requests and rejects stale responses after reset', async () => {
    const requests: {
      request: BatchRequest;
      resolve: (result: BatchResult<Item>) => void;
    }[] = [];
    const f = fixture(request => new Promise((resolve) => {
      requests.push({ request, resolve });
    }));
    const old = f.loader.next();

    await f.loader.next();
    expect(requests).toHaveLength(1);
    f.loader.reset('server-a/user-a', 'name-asc');
    expect(requests[0]?.request.signal.aborted).toBe(true);

    const fresh = f.loader.next();

    requests[0]!.resolve({ items: [{ id: 'stale' }] });
    await old;
    expect(f.state().loading).toBe(true);
    requests[1]!.resolve({ items: [{ id: 'fresh' }] });
    await fresh;
    expect(f.state().items).toEqual([{ id: 'fresh' }]);
  });

  test('deduplicates cards but advances by server response length', async () => {
    const offsets: number[] = [];
    const f = fixture(({ startIndex }) => {
      offsets.push(startIndex);

      return Promise.resolve({ items: batch(startIndex === 50 ? 49 : startIndex, 50) });
    });

    await f.loader.next();
    await f.loader.next();
    await f.loader.next();
    expect(offsets).toEqual([0, 50, 100]);
    expect(f.state().items).toHaveLength(149);
  });

  test('keeps loaded cards and retries the failed offset', async () => {
    let failed = false;
    const offsets: number[] = [];
    const f = fixture(({ startIndex }) => {
      offsets.push(startIndex);

      if (startIndex === 50 && !failed) {
        failed = true;
        throw new Error('offline');
      }

      return Promise.resolve({ items: batch(startIndex, startIndex === 0 ? 50 : 3) });
    });

    await f.loader.next();
    await f.loader.next();
    expect(f.state().error).toBe(true);
    expect(f.state().items).toHaveLength(50);
    await f.loader.next();
    expect(offsets).toEqual([0, 50, 50]);
    expect(f.state().items).toHaveLength(53);
    expect(f.state().hasMore).toBe(false);
    expect(f.state().error).toBe(false);
    await f.loader.next();
    expect(offsets).toHaveLength(3);
  });

  test('scopes cached batches by server, account, query and offset, and supports invalidation', async () => {
    let calls = 0;
    const cache = new BatchCache<BatchResult<Item>>();
    const f = fixture(() => {
      calls++;

      return Promise.resolve({ items: [{ id: String(calls) }] });
    }, cache);

    await f.loader.next();
    f.loader.reset('server-a/user-a', 'release-desc');
    await f.loader.next();
    expect(calls).toBe(1);
    f.loader.reset('server-a/user-b', 'release-desc');
    await f.loader.next();
    f.loader.reset('server-b/user-b', 'release-desc');
    await f.loader.next();
    f.loader.reset('server-b/user-b', 'name-asc');
    await f.loader.next();
    expect(calls).toBe(4);
    cache.clear();
    f.loader.reset('server-b/user-b', 'name-asc');
    await f.loader.next();
    expect(calls).toBe(5);
  });

  test('bounds cache capacity with LRU eviction and TTL expiry', () => {
    let now = 0;
    const cache = new BatchCache<number>(2, 100, () => now);

    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    now = 101;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
  });

  test('dispose aborts and cannot populate state or cache from late results', async () => {
    const { promise, resolve: complete } = Promise.withResolvers<BatchResult<Item>>();
    const cache = new BatchCache<BatchResult<Item>>();
    const f = fixture(() => promise, cache);
    const pending = f.loader.next();

    f.loader.cancel();
    complete({ items: [{ id: 'late' }] });
    await pending;
    expect(f.state().items).toEqual([]);
    expect(cache.size).toBe(0);
  });
});
