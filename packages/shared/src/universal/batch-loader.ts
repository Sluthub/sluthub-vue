/** A short-lived, bounded cache of list batches, separate from complete item details. */
export class BatchCache<T> {
  private readonly entries = new Map<string, {
    value: T;
    expires: number;
  }>();

  public constructor(private readonly capacity = 20, private readonly ttl = 60_000, private readonly now = Date.now) {}

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return;
    }

    this.entries.delete(key);

    if (entry.expires <= this.now()) {
      return;
    }

    this.entries.set(key, entry);

    return entry.value;
  }

  public set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttl });

    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}

export interface BatchResult<T> {
  items: T[];
  total?: number;
}
export interface BatchState<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  error: boolean;
}
export interface BatchRequest {
  startIndex: number;
  limit: number;
  signal: AbortSignal;
}

/** Append-only endless scrolling with one bounded request at a time and cancellable query resets. */
export class BatchLoader<T> {
  private controller?: AbortController;
  private generation = 0;
  private offset = 0;
  private scope = '';
  private query = '';
  private state: BatchState<T> = { items: [], loading: false, hasMore: true, error: false };
  private readonly seen = new Set<string>();

  public constructor(
    private readonly fetch: (request: BatchRequest) => Promise<BatchResult<T>>,
    private readonly identify: (item: T) => string | undefined,
    private readonly changed: (state: BatchState<T>) => void,
    private readonly cache = new BatchCache<BatchResult<T>>(),
    private readonly limit = 50
  ) {}

  private publish(): void { this.changed({ ...this.state }); }

  public reset(scope: string, query: string): void {
    this.cancel();
    this.scope = scope;
    this.query = query;
    this.offset = 0;
    this.seen.clear();
    this.state = { items: [], loading: false, hasMore: true, error: false };
    this.publish();
  }

  public cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
  }

  public update(update: (item: T) => T): void {
    this.state.items = this.state.items.map(item => update(item));
    this.publish();
  }

  public async next(): Promise<void> {
    if (this.state.loading || !this.state.hasMore || !this.scope) {
      return;
    }

    const generation = this.generation;
    const startIndex = this.offset;
    const key = JSON.stringify([this.scope, this.query, startIndex, this.limit]);
    const controller = new AbortController();

    this.controller = controller;
    this.state.loading = true;
    this.state.error = false;
    this.publish();

    try {
      const cached = this.cache.get(key);
      const result = cached ?? await this.fetch({ startIndex, limit: this.limit, signal: controller.signal });

      if (generation !== this.generation || controller.signal.aborted) {
        return;
      }

      if (!cached) {
        this.cache.set(key, result);
      }

      const additions = result.items.filter((item) => {
        const id = this.identify(item);

        if (id && this.seen.has(id)) {
          return false;
        }

        if (id) {
          this.seen.add(id);
        }

        return true;
      });

      this.offset += result.items.length;
      this.state.items = [...this.state.items, ...additions];
      this.state.hasMore = result.items.length >= this.limit
        && (result.total === undefined || this.offset < result.total);
    } catch {
      if (generation !== this.generation || controller.signal.aborted) {
        return;
      }

      this.state.error = true;
    } finally {
      if (generation === this.generation) {
        this.state.loading = false;
        this.controller = undefined;
        this.publish();
      }
    }
  }
}
