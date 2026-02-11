/**
 * Simple in-memory LRU cache with TTL.
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  constructor(
    private maxSize: number = 100,
    private ttlMs: number = 600_000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}
